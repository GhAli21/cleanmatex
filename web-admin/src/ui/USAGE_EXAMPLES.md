# Cmx* Components Usage Examples

This document demonstrates how to use the Project UI Layer components.

## CmxButton

```tsx
import { CmxButton } from '@/components/ui'
import { Plus, Save } from 'lucide-react'

// Basic usage
<CmxButton>Click me</CmxButton>

// With loading state
<CmxButton loading={isLoading}>Save</CmxButton>

// With icons
<CmxButton leftIcon={<Plus />}>Add New</CmxButton>
<CmxButton rightIcon={<Save />}>Save</CmxButton>

// With variants (from shadcn Button)
<CmxButton variant="destructive">Delete</CmxButton>
<CmxButton variant="outline">Cancel</CmxButton>
<CmxButton variant="ghost">Close</CmxButton>
```

## CmxInput

```tsx
import { CmxInput } from '@/components/ui'

// Basic usage
<CmxInput placeholder="Enter text..." />

// With type
<CmxInput type="email" placeholder="Enter email..." />
<CmxInput type="password" placeholder="Enter password..." />

// With React Hook Form
<CmxInput {...field} />
```

## CmxForm + CmxFormField

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CmxForm, CmxFormField, CmxInput, CmxButton } from '@/components/ui'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
})

type FormValues = z.infer<typeof schema>

export function MyForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
    },
  })

  async function onSubmit(values: FormValues) {
    console.log(values)
  }

  return (
    <CmxForm form={form} onSubmit={onSubmit}>
      <CmxFormField form={form} name="name" label="Name">
        {({ field }) => <CmxInput {...field} />}
      </CmxFormField>

      <CmxFormField
        form={form}
        name="email"
        label="Email"
        description="We'll never share your email."
      >
        {({ field }) => <CmxInput type="email" {...field} />}
      </CmxFormField>

      <CmxButton type="submit" loading={form.formState.isSubmitting}>
        Submit
      </CmxButton>
    </CmxForm>
  )
}
```

## CmxDataTable

```tsx
'use client'

import { CmxDataTable } from '@/components/ui'
import type { ColumnDef } from '@tanstack/react-table'

interface User {
  id: string
  name: string
  email: string
}

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
]

export function UsersTable({ users }: { users: User[] }) {
  return <CmxDataTable columns={columns} data={users} />
}
```

## CmxChart

```tsx
'use client'

import { CmxChart } from '@/components/ui'

const data = [
  { month: 'Jan', revenue: 4000 },
  { month: 'Feb', revenue: 3000 },
  { month: 'Mar', revenue: 5000 },
  { month: 'Apr', revenue: 4500 },
]

export function RevenueChart() {
  return (
    <CmxChart
      data={data}
      xKey="month"
      yKey="revenue"
    />
  )
}
```

## CmxToast

```tsx
'use client'

import { showSuccessToast, showErrorToast, showInfoToast } from '@/components/ui'

function handleSuccess() {
  showSuccessToast('Operation successful!', {
    description: 'Your changes have been saved.',
  })
}

function handleError() {
  showErrorToast('Operation failed!', {
    description: 'Please try again later.',
  })
}

function handleInfo() {
  showInfoToast('New update available', {
    description: 'Version 2.0 is ready to install.',
  })
}
```

## Complete Example: Create User Form

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  CmxForm,
  CmxFormField,
  CmxInput,
  CmxButton,
  showSuccessToast,
  showErrorToast
} from '@/components/ui'
import { Save } from 'lucide-react'

const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.string().min(1, 'Role is required'),
})

type UserFormValues = z.infer<typeof userSchema>

export function CreateUserForm() {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
    },
  })

  async function onSubmit(values: UserFormValues) {
    try {
      // API call would go here
      await new Promise(resolve => setTimeout(resolve, 1000))

      showSuccessToast('User created successfully!', {
        description: `${values.name} has been added to the system.`,
      })

      form.reset()
    } catch (error) {
      showErrorToast('Failed to create user', {
        description: 'Please try again later.',
      })
    }
  }

  return (
    <CmxForm form={form} onSubmit={onSubmit} className="space-y-4">
      <CmxFormField
        form={form}
        name="name"
        label="Full Name"
        description="Enter the user's full name"
      >
        {({ field }) => <CmxInput placeholder="John Doe" {...field} />}
      </CmxFormField>

      <CmxFormField
        form={form}
        name="email"
        label="Email Address"
      >
        {({ field }) => <CmxInput type="email" placeholder="john@example.com" {...field} />}
      </CmxFormField>

      <CmxFormField
        form={form}
        name="role"
        label="Role"
      >
        {({ field }) => <CmxInput placeholder="Administrator" {...field} />}
      </CmxFormField>

      <CmxButton
        type="submit"
        loading={form.formState.isSubmitting}
        rightIcon={<Save />}
      >
        Create User
      </CmxButton>
    </CmxForm>
  )
}
```

## Import from Barrel Export

All components are exported from the barrel export:

```tsx
// ✅ Good: Import from barrel export
import {
  CmxButton,
  CmxInput,
  CmxForm,
  CmxFormField,
  CmxDataTable,
  CmxChart,
  showSuccessToast,
  showErrorToast,
  showInfoToast
} from '@/components/ui'

// ❌ Bad: Don't import individual files
import { CmxButton } from '@/components/ui/cmx-button'
```
