# Next.js Page Template

## 📁 Page Structure (App Router)

```
app/[locale]/(dashboard)/{feature}/
├── page.tsx                    # Main page (Server Component)
├── loading.tsx                 # Loading state
├── error.tsx                   # Error boundary
├── not-found.tsx              # 404 page
└── components/
    ├── {feature}-list.tsx      # Client component for list
    ├── {feature}-form.tsx      # Client component for form
    └── {feature}-filters.tsx   # Client component for filters
```

---

## 📄 Main Page Template (Server Component)

**File**: `app/[locale]/(dashboard)/{feature}/page.tsx`

```typescript
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { {Feature}List } from './components/{feature}-list';
import { {Feature}Filters } from './components/{feature}-filters';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: {
    locale: string;
  };
  searchParams: {
    page?: string;
    search?: string;
    status?: string;
  };
}

export default async function {Feature}Page({ params, searchParams }: PageProps) {
  const t = await getTranslations('{feature}');
  
  // Parse query parameters
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const status = searchParams.status || '';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>
        
        <Link href={`/${params.locale}/dashboard/{feature}/new`}>
          <Button>
            <PlusIcon className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
            {t('create')}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <{Feature}Filters initialValues={{ search, status }} />

      {/* List with Suspense */}
      <Suspense fallback={<{Feature}ListSkeleton />}>
        <{Feature}List page={page} search={search} status={status} />
      </Suspense>
    </div>
  );
}

// Loading skeleton component
function {Feature}ListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
```

---

## 🔄 Loading State

**File**: `app/[locale]/(dashboard)/{feature}/loading.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-48" />
      </div>

      {/* List Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
```

---

## ❌ Error Boundary

**File**: `app/[locale]/(dashboard)/{feature}/error.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="container mx-auto py-12">
      <div className="max-w-md mx-auto text-center space-y-6">
        <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Something went wrong!</h2>
          <p className="text-muted-foreground">
            We encountered an error while loading this page.
          </p>
        </div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
```

---

## 📋 List Component (Client Component)

**File**: `app/[locale]/(dashboard)/{feature}/components/{feature}-list.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface {Feature}ListProps {
  page: number;
  search: string;
  status: string;
}

export function {Feature}List({ page, search, status }: {Feature}ListProps) {
  const t = useTranslations('{feature}');
  const params = useParams();
  
  // Fetch data with React Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['{feature}', page, search, status],
    queryFn: () => api.get{Features}({ page, search, status }),
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Error loading {feature}
      </div>
    );
  }

  if (!data?.data.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{t('empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Items */}
      {data.data.map((item: any) => (
        <Card key={item.id}>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div>
                <Link
                  href={`/${params.locale}/dashboard/{feature}/${item.id}`}
                  className="font-semibold hover:underline"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant={getStatusVariant(item.status)}>
                {t(`status.${item.status}`)}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/${params.locale}/dashboard/{feature}/${item.id}/edit`}
                    >
                      <Edit className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
                      {t('edit')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
                    {t('delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Pagination */}
      <{Feature}Pagination
        currentPage={page}
        totalPages={data.meta.totalPages}
      />
    </div>
  );
}

function getStatusVariant(status: string) {
  const variants: Record<string, any> = {
    active: 'default',
    pending: 'secondary',
    inactive: 'outline',
  };
  return variants[status] || 'default';
}

function handleDelete(id: string) {
  // Implement delete logic
  console.log('Delete:', id);
}
```

---

## 🔍 Filters Component

**File**: `app/[locale]/(dashboard)/{feature}/components/{feature}-filters.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDebounce } from '@/lib/hooks/use-debounce';

interface FiltersProps {
  initialValues: {
    search: string;
    status: string;
  };
}

export function {Feature}Filters({ initialValues }: FiltersProps) {
  const t = useTranslations('{feature}');
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialValues.search);
  const [status, setStatus] = useState(initialValues.status);
  
  // Debounce search input
  const debouncedSearch = useDebounce(search, 500);

  useEffect(() => {
    updateURL({ search: debouncedSearch, status });
  }, [debouncedSearch, status]);

  function updateURL(newParams: { search?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newParams.search) {
      params.set('search', newParams.search);
    } else {
      params.delete('search');
    }

    if (newParams.status) {
      params.set('status', newParams.status);
    } else {
      params.delete('status');
    }

    router.push(`?${params.toString()}`);
  }

  function clearFilters() {
    setSearch('');
    setStatus('');
    router.push(window.location.pathname);
  }

  return (
    <div className="flex gap-4 items-center">
      {/* Search Input */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('search-placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rtl:pl-4 rtl:pr-10"
        />
      </div>

      {/* Status Filter */}
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder={t('filter-status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('status.all')}</SelectItem>
          <SelectItem value="active">{t('status.active')}</SelectItem>
          <SelectItem value="pending">{t('status.pending')}</SelectItem>
          <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {(search || status) && (
        <Button variant="ghost" size="icon" onClick={clearFilters}>
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
```

---

## 📝 Form Component

**File**: `app/[locale]/(dashboard)/{feature}/components/{feature}-form.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type FormValues = z.infer<typeof formSchema>;

interface {Feature}FormProps {
  initialData?: Partial<FormValues>;
  id?: string;
}

export function {Feature}Form({ initialData, id }: {Feature}FormProps) {
  const t = useTranslations('{feature}');
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: '',
      description: '',
      status: 'active',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      id ? api.update{Feature}(id, data) : api.create{Feature}(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['{feature}'] });
      toast.success(id ? t('updated-success') : t('created-success'));
      router.push('/dashboard/{feature}');
    },
    onError: (error: any) => {
      toast.error(error.message || t('error'));
    },
  });

  function onSubmit(data: FormValues) {
    mutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.name')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>{t('form.name-description')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.description')}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={mutation.isPending}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

---

## 🌍 Translation File Template

**File**: `messages/en.json`

```json
{
  "{feature}": {
    "title": "{Features}",
    "description": "Manage your {features}",
    "create": "Create {Feature}",
    "edit": "Edit",
    "delete": "Delete",
    "search-placeholder": "Search {features}...",
    "filter-status": "Filter by status",
    "empty": "No {features} found",
    "created-success": "{Feature} created successfully",
    "updated-success": "{Feature} updated successfully",
    "error": "Something went wrong",
    "status": {
      "all": "All",
      "active": "Active",
      "pending": "Pending",
      "inactive": "Inactive"
    },
    "form": {
      "name": "Name",
      "name-description": "Enter the {feature} name",
      "description": "Description"
    },
    "save": "Save",
    "saving": "Saving...",
    "cancel": "Cancel"
  }
}
```

---

## ✅ Checklist for New Page

- [ ] Create page.tsx (Server Component)
- [ ] Add loading.tsx for loading state
- [ ] Add error.tsx for error boundary
- [ ] Create client components in components/ folder
- [ ] Add translations to messages/en.json and messages/ar.json
- [ ] Setup React Query for data fetching
- [ ] Implement forms with react-hook-form + zod
- [ ] Add proper TypeScript types
- [ ] Test RTL layout for Arabic
- [ ] Add loading skeletons
- [ ] Implement error handling
- [ ] Add pagination if needed
- [ ] Test responsive design

---

**Last Updated**: 2025-01-09
