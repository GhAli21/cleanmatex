import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'

export interface WorkflowProfileStageView {
  code: string
  name: string
  name2: string | null
  type: string
  sequence: number
  isTerminal: boolean
}

export interface WorkflowProfileTemplateView {
  assignmentId: string
  templateId: string
  templateCode: string
  templateName: string
  templateName2: string | null
  templateDescription: string | null
  isDefault: boolean
  allowBackSteps: boolean
  isActive: boolean
  stages: WorkflowProfileStageView[]
}

export interface WorkflowProfileCategoryOverrideView {
  id: string
  serviceCategoryCode: string
  serviceCategoryName: string | null
  serviceCategoryName2: string | null
  templateCode: string | null
  templateName: string | null
  templateName2: string | null
  usePreparationScreen: boolean | null
  useAssemblyScreen: boolean | null
  useQaScreen: boolean | null
  trackIndividualPiece: boolean | null
}

export interface WorkflowProfileSettingsFlagsView {
  usePreparationScreen: boolean
  useAssemblyScreen: boolean
  useQaScreen: boolean
  trackIndividualPiece: boolean
  ordersSplitEnabled: boolean
}

export interface WorkflowProfileAssignmentView {
  id: string
  workflowProfileId: string
  workflowVersionNo: number | null
  branchId: string | null
  serviceCode: string | null
  isDefault: boolean
  isActive: boolean
}

export interface WorkflowProfileScreenStatusView {
  code: string
  name: string
  name2: string | null
}

export interface WorkflowProfileScreenView {
  screenKey: string
  name: string
  name2: string | null
  statuses: WorkflowProfileScreenStatusView[]
}

export interface TenantWorkflowProfileView {
  settingsFlags: WorkflowProfileSettingsFlagsView | null
  approvedTemplates: WorkflowProfileTemplateView[]
  categoryOverrides: WorkflowProfileCategoryOverrideView[]
  workflowAssignments: WorkflowProfileAssignmentView[]
  workflowScreens: WorkflowProfileScreenView[]
}

type WorkflowAssignmentRow = {
  id: string
  workflow_profile_id: string
  workflow_version_no: number | null
  branch_id: string | null
  service_code: string | null
  is_default: boolean | null
  is_active: boolean | null
}

type WorkflowScreenRow = {
  screen_key: string
  screen_name: string
  screen_name2: string | null
  screen_display_order: number
  status_code: string | null
  status_name: string | null
  status_name2: string | null
  status_display_order: number | null
}

function asBoolean(value: boolean | null | undefined): boolean {
  return value === true
}

async function listWorkflowAssignments(
  tenantId: string,
): Promise<WorkflowProfileAssignmentView[]> {
  try {
    const rows = await prisma.$queryRaw<WorkflowAssignmentRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        wf_profile_id::text AS workflow_profile_id,
        wf_version_no AS workflow_version_no,
        branch_id::text AS branch_id,
        service_code,
        is_default,
        is_active
      FROM public.org_wf_profile_assign_cf
      WHERE tenant_org_id = CAST(${tenantId} AS uuid)
        AND COALESCE(rec_status, 1) = 1
      ORDER BY COALESCE(is_default, false) DESC, service_code ASC NULLS FIRST, branch_id ASC NULLS FIRST
    `)

    return rows.map((row) => ({
      id: row.id,
      workflowProfileId: row.workflow_profile_id,
      workflowVersionNo: row.workflow_version_no,
      branchId: row.branch_id,
      serviceCode: row.service_code,
      isDefault: row.is_default !== false,
      isActive: row.is_active !== false,
    }))
  } catch {
    return []
  }
}

async function listWorkflowScreens(): Promise<WorkflowProfileScreenView[]> {
  try {
    const rows = await prisma.$queryRaw<WorkflowScreenRow[]>(Prisma.sql`
      SELECT
        s.screen_key,
        s.name AS screen_name,
        s.name2 AS screen_name2,
        COALESCE(s.display_order, 0) AS screen_display_order,
        st.status_code,
        st.name AS status_name,
        st.name2 AS status_name2,
        COALESCE(ss.display_order, st.display_order, 0) AS status_display_order
      FROM public.sys_wf_screens_cd s
      LEFT JOIN public.sys_wf_screen_status_cd ss
        ON ss.screen_key = s.screen_key
       AND COALESCE(ss.is_active, true) = true
      LEFT JOIN public.sys_wf_statuses_cd st
        ON st.status_code = ss.status_code
       AND COALESCE(st.is_active, true) = true
      WHERE COALESCE(s.is_active, true) = true
        AND COALESCE(s.rec_status, 1) = 1
      ORDER BY
        COALESCE(s.display_order, 0) ASC,
        s.screen_key ASC,
        COALESCE(ss.display_order, st.display_order, 0) ASC,
        st.status_code ASC
    `)

    const screens = new Map<string, WorkflowProfileScreenView>()

    for (const row of rows) {
      const existing =
        screens.get(row.screen_key) ??
        {
          screenKey: row.screen_key,
          name: row.screen_name,
          name2: row.screen_name2,
          statuses: [],
        }

      if (row.status_code && row.status_name) {
        existing.statuses.push({
          code: row.status_code,
          name: row.status_name,
          name2: row.status_name2,
        })
      }

      screens.set(row.screen_key, existing)
    }

    return [...screens.values()]
  } catch {
    return []
  }
}

export async function getTenantWorkflowProfileView(
  tenantId: string,
): Promise<TenantWorkflowProfileView> {
  const [{ settingsFlags, approvedTemplates, categoryOverrides }, workflowAssignments, workflowScreens] =
    await Promise.all([
      withTenantContext(tenantId, async () => {
        const [settingsFlags, approvedTemplates, categoryOverrides] = await Promise.all([
          prisma.org_tenant_workflow_settings_cf.findUnique({
            where: { tenant_org_id: tenantId },
          }),
          prisma.org_tenant_workflow_templates_cf.findMany({
            where: {
              tenant_org_id: tenantId,
              rec_status: { not: 0 },
              is_active: { not: false },
            },
            include: {
              sys_workflow_template_cd: {
                include: {
                  sys_workflow_template_stages: {
                    where: {
                      rec_status: { not: 0 },
                      is_active: { not: false },
                    },
                    orderBy: [{ seq_no: 'asc' }, { stage_code: 'asc' }],
                  },
                },
              },
            },
            orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
          }),
          prisma.org_tenant_service_category_workflow_cf.findMany({
            where: {
              tenant_org_id: tenantId,
              rec_status: { not: 0 },
            },
            include: {
              org_service_category_cf: {
                select: {
                  name: true,
                  name2: true,
                },
              },
              sys_workflow_template_cd: {
                select: {
                  template_code: true,
                  template_name: true,
                  template_name2: true,
                },
              },
            },
            orderBy: [{ service_category_code: 'asc' }],
          }),
        ])

        return {
          settingsFlags,
          approvedTemplates,
          categoryOverrides,
        }
      }),
      listWorkflowAssignments(tenantId),
      listWorkflowScreens(),
    ])

  return {
    settingsFlags: settingsFlags
      ? {
          usePreparationScreen: asBoolean(settingsFlags.use_preparation_screen),
          useAssemblyScreen: asBoolean(settingsFlags.use_assembly_screen),
          useQaScreen: asBoolean(settingsFlags.use_qa_screen),
          trackIndividualPiece: asBoolean(settingsFlags.track_individual_piece),
          ordersSplitEnabled: asBoolean(settingsFlags.orders_split_enabled),
        }
      : null,
    approvedTemplates: approvedTemplates.map((assignment) => ({
      assignmentId: assignment.id,
      templateId: assignment.template_id,
      templateCode: assignment.sys_workflow_template_cd.template_code,
      templateName: assignment.sys_workflow_template_cd.template_name,
      templateName2: assignment.sys_workflow_template_cd.template_name2,
      templateDescription: assignment.sys_workflow_template_cd.template_desc,
      isDefault: assignment.is_default === true,
      allowBackSteps: assignment.allow_back_steps === true,
      isActive: assignment.is_active !== false,
      stages: assignment.sys_workflow_template_cd.sys_workflow_template_stages.map((stage) => ({
        code: stage.stage_code,
        name: stage.stage_name,
        name2: stage.stage_name2,
        type: stage.stage_type,
        sequence: stage.seq_no,
        isTerminal: stage.is_terminal === true,
      })),
    })),
    categoryOverrides: categoryOverrides.map((override) => ({
      id: override.id,
      serviceCategoryCode: override.service_category_code,
      serviceCategoryName: override.org_service_category_cf?.name ?? null,
      serviceCategoryName2: override.org_service_category_cf?.name2 ?? null,
      templateCode: override.sys_workflow_template_cd?.template_code ?? null,
      templateName: override.sys_workflow_template_cd?.template_name ?? null,
      templateName2: override.sys_workflow_template_cd?.template_name2 ?? null,
      usePreparationScreen: override.use_preparation_screen,
      useAssemblyScreen: override.use_assembly_screen,
      useQaScreen: override.use_qa_screen,
      trackIndividualPiece: override.track_individual_piece,
    })),
    workflowAssignments,
    workflowScreens,
  }
}
