/**
 * GET /api/v1/pricing/history
 * Get price change history with optional filters
 * 
 * Query Parameters:
 * - priceListId?: string - Filter by price list
 * - productId?: string - Filter by product
 * - fromDate?: string - Filter from date (ISO format)
 * - toDate?: string - Filter to date (ISO format)
 * - userId?: string - Filter by user who made the change
 * - entityType?: 'price_list_item' | 'product_default' - Filter by entity type
 * - limit?: number - Limit results (default: 100)
 * - offset?: number - Offset for pagination (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTenantIdFromSession } from '@/lib/db/tenant-context'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
    try {
        const tenantId = await getTenantIdFromSession()
        if (!tenantId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const searchParams = request.nextUrl.searchParams
        const priceListId = searchParams.get('priceListId')
        const productId = searchParams.get('productId')
        const fromDate = searchParams.get('fromDate')
        const toDate = searchParams.get('toDate')
        const userId = searchParams.get('userId')
        const entityType = searchParams.get('entityType') as 'price_list_item' | 'product_default' | null
        const limit = parseInt(searchParams.get('limit') || '100', 10)
        const offset = parseInt(searchParams.get('offset') || '0', 10)

        // Build where clause
        const where: any = {
            tenant_org_id: tenantId,
        }

        if (priceListId) {
            where.price_list_id = priceListId
        }

        if (productId) {
            where.product_id = productId
        }

        if (fromDate) {
            where.created_at = {
                ...where.created_at,
                gte: new Date(fromDate),
            }
        }

        if (toDate) {
            where.created_at = {
                ...where.created_at,
                lte: new Date(toDate),
            }
        }

        if (userId) {
            where.created_by = userId
        }

        if (entityType) {
            where.entity_type = entityType
        }

        // Build dynamic query conditions
        const conditions: string[] = [`pha.tenant_org_id = $1::uuid`]
        const params: any[] = [tenantId]
        let paramIndex = 2

        if (priceListId) {
            conditions.push(`pha.price_list_id = $${paramIndex}::uuid`)
            params.push(priceListId)
            paramIndex++
        }

        if (productId) {
            conditions.push(`pha.product_id = $${paramIndex}::uuid`)
            params.push(productId)
            paramIndex++
        }

        if (fromDate) {
            conditions.push(`pha.created_at >= $${paramIndex}::timestamp`)
            params.push(new Date(fromDate))
            paramIndex++
        }

        if (toDate) {
            conditions.push(`pha.created_at <= $${paramIndex}::timestamp`)
            params.push(new Date(toDate))
            paramIndex++
        }

        if (userId) {
            conditions.push(`pha.created_by = $${paramIndex}::uuid`)
            params.push(userId)
            paramIndex++
        }

        if (entityType) {
            conditions.push(`pha.entity_type = $${paramIndex}`)
            params.push(entityType)
            paramIndex++
        }

        const whereClause = conditions.join(' AND ')

        // Fetch price history with user names using parameterized query
        const history = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        pha.id,
        pha.tenant_org_id,
        pha.entity_type,
        pha.entity_id,
        pha.price_list_id,
        pha.product_id,
        pha.old_price,
        pha.new_price,
        pha.old_discount_percent,
        pha.new_discount_percent,
        pha.change_reason,
        pha.effective_from,
        pha.effective_to,
        pha.created_at,
        pha.created_by,
        pha.created_info,
        pl.name as price_list_name,
        pd.product_name,
        pd.product_name2,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email as user_email
      FROM org_price_history_audit pha
      LEFT JOIN org_price_lists_mst pl ON pha.price_list_id = pl.id AND pha.tenant_org_id = pl.tenant_org_id
      LEFT JOIN org_product_data_mst pd ON pha.product_id = pd.id AND pha.tenant_org_id = pd.tenant_org_id
      LEFT JOIN org_users_mst u ON pha.created_by = u.id AND pha.tenant_org_id = u.tenant_org_id
      WHERE ${whereClause}
      ORDER BY pha.created_at DESC
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `, ...params, limit, offset)

        // Get total count
        const totalCount = await prisma.org_price_history_audit.count({
            where,
        })

        return NextResponse.json({
            data: history,
            pagination: {
                total: totalCount,
                limit,
                offset,
                hasMore: offset + limit < totalCount,
            },
        })
    } catch (error: any) {
        console.error('Error fetching price history:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to fetch price history' },
            { status: 500 }
        )
    }
}

