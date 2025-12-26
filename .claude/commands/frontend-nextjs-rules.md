# Next.js Web Admin Development Rules

## What is Next.js?
Next.js is a React framework that makes building web applications easier. It handles routing, server-side rendering, and optimization automatically.

**Key Features:**
- **File-based routing**: Folders = routes
- **Server & Client Components**: Choose where code runs
- **Built-in optimization**: Images, fonts, scripts auto-optimized
- **TypeScript**: Type-safe by default

## Project Structure (App Router - Next.js 13+)
```
/src
  /app
    /(auth)
      /login
        page.tsx       # Login page
      /register
        page.tsx
    /(dashboard)
      /layout.tsx      # Dashboard layout
      /page.tsx        # Home/dashboard page
      /orders
        /page.tsx      # Orders list
        /[id]
          /page.tsx    # Order details (dynamic route)
      /customers
      /settings
    /api
      /orders
        /route.ts      # API endpoint
    layout.tsx         # Root layout
    page.tsx          # Landing page
    globals.css       # Global styles
  /components
    /ui               # Reusable UI components
    /forms            # Form components
    /layouts          # Layout components
  /lib
    /api-client.ts    # API client
    /utils.ts         # Helper functions
  /hooks              # Custom React hooks
  /types              # TypeScript types
  /constants          # Constants
```

## Routing Explained

### File-based Routing
```
/app
  /page.tsx                    → /
  /about/page.tsx              → /about
  /orders/page.tsx             → /orders
  /orders/[id]/page.tsx        → /orders/123 (dynamic)
  /orders/new/page.tsx         → /orders/new
  /(auth)/login/page.tsx       → /login (route group, no URL segment)
```

### Creating a Page
```typescript
// app/orders/page.tsx
export default function OrdersPage() {
  return (
    <div>
      <h1>Orders</h1>
      {/* Page content */}
    </div>
  );
}

// Add metadata
export const metadata = {
  title: 'Orders | CleanMateX',
  description: 'Manage your laundry orders',
};
```

### Dynamic Routes
```typescript
// app/orders/[id]/page.tsx
interface PageProps {
  params: {
    id: string;  // URL parameter
  };
}

export default function OrderDetailPage({ params }: PageProps) {
  const { id } = params;
  
  return (
    <div>
      <h1>Order {id}</h1>
    </div>
  );
}
```

### Layouts (Shared UI)
```typescript
// app/(dashboard)/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800">
        <nav>
          <a href="/dashboard">Dashboard</a>
          <a href="/orders">Orders</a>
          <a href="/customers">Customers</a>
        </nav>
      </aside>
      
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}  {/* Pages render here */}
      </main>
    </div>
  );
}
```

## Server vs Client Components

### Server Components (Default - Recommended)
```typescript
// app/orders/page.tsx
// No 'use client' = Server Component
// Runs on server, sends HTML to browser

import { getOrders } from '@/lib/api';

export default async function OrdersPage() {
  // Fetch data directly (no useEffect needed!)
  const orders = await getOrders();
  
  return (
    <div>
      {orders.map(order => (
        <div key={order.id}>{order.orderNumber}</div>
      ))}
    </div>
  );
}
```

**When to Use Server Components:**
- Fetching data
- Accessing backend resources
- Keeping sensitive info on server (API keys)
- Large dependencies that don't need interactivity

### Client Components
```typescript
// components/order-form.tsx
'use client';  // This marks it as a Client Component

import { useState } from 'react';

export default function OrderForm() {
  // useState only works in Client Components
  const [formData, setFormData] = useState({});
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Handle form submission
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Interactive form */}
    </form>
  );
}
```

**When to Use Client Components:**
- useState, useEffect, other hooks
- Event listeners (onClick, onChange)
- Browser APIs (localStorage, window)
- Interactive features

### Mixing Server & Client
```typescript
// app/orders/[id]/page.tsx (Server Component)
import OrderDetails from '@/components/order-details';
import OrderActions from '@/components/order-actions';  // Client component

export default async function OrderPage({ params }) {
  // Fetch on server
  const order = await getOrder(params.id);
  
  return (
    <div>
      {/* Server component */}
      <OrderDetails order={order} />
      
      {/* Client component for interactivity */}
      <OrderActions orderId={order.id} />
    </div>
  );
}
```

## Data Fetching Patterns

### Server-Side Fetch
```typescript
// app/orders/page.tsx
async function getOrders() {
  const res = await fetch('http://localhost:3000/api/orders', {
    cache: 'no-store',  // Always fetch fresh data
    // OR
    next: { revalidate: 60 },  // Cache for 60 seconds
  });
  
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}

export default async function OrdersPage() {
  const orders = await getOrders();
  return <OrdersList orders={orders} />;
}
```

### Client-Side Fetch with SWR
```typescript
// components/orders-list.tsx
'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function OrdersList() {
  const { data, error, isLoading } = useSWR('/api/orders', fetcher);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading orders</div>;
  
  return (
    <div>
      {data.orders.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
```

**Why SWR?**
- Automatic caching
- Revalidation on focus
- Optimistic updates
- Less code than useEffect

## API Routes (Backend in Next.js)

### Creating API Endpoints
```typescript
// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';

// GET /api/orders
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    
    // Fetch from your backend or database
    const orders = await prismaClient.order.findMany({
      where: status ? { status } : {},
    });
    
    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST /api/orders
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate
    if (!body.customerId || !body.items) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Create order
    const order = await prismaClient.order.create({
      data: body,
    });
    
    return NextResponse.json({
      success: true,
      data: order,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
```

### Dynamic API Routes
```typescript
// app/api/orders/[id]/route.ts
interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/orders/123
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const order = await prismaClient.order.findUnique({
    where: { id: params.id },
  });
  
  if (!order) {
    return NextResponse.json(
      { error: 'Order not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({ data: order });
}

// PATCH /api/orders/123
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const body = await request.json();
  
  const order = await prismaClient.order.update({
    where: { id: params.id },
    data: body,
  });
  
  return NextResponse.json({ data: order });
}
```

## Styling with TailwindCSS

### What is TailwindCSS?
Utility-first CSS framework - write styles using class names instead of CSS files.

### Setup
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

### Using Tailwind Classes
```typescript
// components/order-card.tsx
export default function OrderCard({ order }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          {order.orderNumber}
        </h3>
        <span className={`
          px-2 py-1 rounded-full text-xs font-medium
          ${order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : ''}
          ${order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : ''}
        `}>
          {order.status}
        </span>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        {order.customerName}
      </p>
      
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900">
          ${order.total}
        </span>
        <button className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
}
```

**Common Tailwind Patterns:**
```typescript
// Spacing
p-4        // padding: 1rem
m-2        // margin: 0.5rem
mx-auto    // margin-left: auto, margin-right: auto
space-y-4  // gap between children

// Typography
text-lg    // font-size: 1.125rem
font-bold  // font-weight: 700
text-center // text-align: center

// Layout
flex       // display: flex
grid       // display: grid
grid-cols-3 // 3 columns
gap-4      // gap: 1rem

// Colors
bg-blue-500     // background-color
text-white      // color
border-gray-200 // border-color

// Responsive
md:text-xl      // Apply at medium screens and up
lg:grid-cols-4  // 4 columns on large screens

// Hover/Focus
hover:bg-blue-600
focus:ring-2
```

## Internationalization (i18n)

### Setup with next-intl
```bash
npm install next-intl
```

```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
```

```json
// messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "orders": {
    "title": "Orders",
    "create": "Create Order",
    "status": {
      "pending": "Pending",
      "completed": "Completed"
    }
  }
}

// messages/ar.json
{
  "common": {
    "save": "حفظ",
    "cancel": "إلغاء"
  },
  "orders": {
    "title": "الطلبات",
    "create": "إنشاء طلب",
    "status": {
      "pending": "قيد الانتظار",
      "completed": "مكتمل"
    }
  }
}
```

### Using Translations
```typescript
// components/orders-page.tsx
'use client';

import { useTranslations } from 'next-intl';

export default function OrdersPage() {
  const t = useTranslations('orders');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('create')}</button>
      
      <div>
        <span>{t('status.pending')}</span>
      </div>
    </div>
  );
}
```

### RTL Support
```typescript
// app/[locale]/layout.tsx
export default function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  
  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

## Forms with React Hook Form

### Why React Hook Form?
- Better performance (fewer re-renders)
- Built-in validation
- Less code than controlled components

```typescript
// components/order-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Define validation schema
const orderSchema = z.object({
  customerId: z.string().uuid('Invalid customer'),
  items: z.array(z.object({
    serviceId: z.string().uuid(),
    quantity: z.number().min(1),
  })).min(1, 'At least one item required'),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

export default function OrderForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  });
  
  const onSubmit = async (data: OrderFormData) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) throw new Error('Failed to create order');
      
      // Success! Redirect or show message
    } catch (error) {
      console.error(error);
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Customer ID
        </label>
        <input
          {...register('customerId')}
          className="w-full border rounded-md px-3 py-2"
        />
        {errors.customerId && (
          <p className="text-red-500 text-sm mt-1">
            {errors.customerId.message}
          </p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">
          Notes
        </label>
        <textarea
          {...register('notes')}
          className="w-full border rounded-md px-3 py-2"
          rows={3}
        />
      </div>
      
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50"
      >
        {isSubmitting ? 'Creating...' : 'Create Order'}
      </button>
    </form>
  );
}
```

## Authentication

### Setup NextAuth.js
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Call your backend API
        const res = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(credentials),
          headers: { 'Content-Type': 'application/json' }
        });
        
        const user = await res.json();
        
        if (res.ok && user) {
          return user;
        }
        
        return null;
      }
    })
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
```

### Protected Routes
```typescript
// app/(dashboard)/layout.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }) {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/login');
  }
  
  return <div>{children}</div>;
}
```

## State Management with Zustand

### Why Zustand?
- Simple API
- No boilerplate
- TypeScript-friendly
- Good for solo development

```typescript
// lib/stores/order-store.ts
import { create } from 'zustand';

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: () => Promise<void>;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,
  
  fetchOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      set({ orders: data.orders, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch orders', isLoading: false });
    }
  },
  
  addOrder: (order) => {
    set((state) => ({
      orders: [...state.orders, order],
    }));
  },
  
  updateOrder: (id, updates) => {
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    }));
  },
}));

// Usage in component
'use client';

import { useOrderStore } from '@/lib/stores/order-store';

export default function OrdersList() {
  const { orders, isLoading, fetchOrders } = useOrderStore();
  
  useEffect(() => {
    fetchOrders();
  }, []);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {orders.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
```

## Performance Optimization

### Image Optimization
```typescript
import Image from 'next/image';

// ✅ GOOD - Optimized automatically
<Image
  src="/order-image.jpg"
  alt="Order image"
  width={300}
  height={200}
  priority  // Load immediately (above fold)
/>

// For external images
<Image
  src="https://example.com/image.jpg"
  alt="Image"
  width={300}
  height={200}
  unoptimized  // Skip optimization if needed
/>
```

### Loading States
```typescript
// app/orders/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-20 bg-gray-200 rounded"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}
```

### Error Boundaries
```typescript
// app/orders/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="text-center py-10">
      <h2 className="text-xl font-bold text-red-600">
        Something went wrong!
      </h2>
      <p className="text-gray-600 mt-2">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md"
      >
        Try again
      </button>
    </div>
  );
}
```

## Essential Packages

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    
    "next-intl": "^3.0.0",
    "next-auth": "^4.24.0",
    
    "react-hook-form": "^7.49.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0",
    
    "swr": "^2.2.0",
    "zustand": "^4.4.0",
    
    "@tanstack/react-table": "^8.10.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.300.0"
  }
}
```

## Naming Conventions

### File Naming

- **Pages**: `page.tsx` (App Router) or `{name}.tsx` (Pages Router)
- **Components**: `{component-name}.tsx` (e.g., `order-card.tsx`, `loading-indicator.tsx`)
- **Server Components**: `{name}.tsx` (no 'use client')
- **Client Components**: `{name}.tsx` with `'use client'` directive
- **API Routes**: `route.ts` (App Router) or `{name}.ts` (Pages Router)
- **Hooks**: `use{name}.ts` (e.g., `useOrders.ts`, `useAuth.ts`)
- **Utils**: `{utility-name}.ts` (e.g., `formatters.ts`, `validators.ts`)
- **Types**: `{name}.types.ts` or `types.ts` (e.g., `order.types.ts`)
- **Constants**: `{scope}.constants.ts` (e.g., `app.constants.ts`, `order.constants.ts`)
- **Stores**: `{name}-store.ts` (e.g., `order-store.ts`, `auth-store.ts`)

### Component Naming

- **Components**: `PascalCase` (e.g., `OrderCard`, `LoadingIndicator`, `OrdersList`)
- **Hooks**: `camelCase` with `use` prefix (e.g., `useOrders`, `useAuth`, `useTenant`)
- **Utils**: `camelCase` functions (e.g., `formatCurrency`, `validateEmail`)
- **Types/Interfaces**: `PascalCase` (e.g., `Order`, `OrderStatus`, `CreateOrderDto`)

### Variable & Function Naming

- **Variables**: `camelCase` (e.g., `orderList`, `selectedOrder`, `isLoading`)
- **Functions**: `camelCase` (e.g., `getOrders()`, `createOrder()`, `handleSubmit()`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_ORDER_ITEMS`, `API_BASE_URL`)
- **Boolean variables**: Prefix with `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasError`)

### Examples

```typescript
// ✅ Good: Clear, descriptive names
export default function OrdersListPage() {}
export function OrderCard({ order }: OrderCardProps) {}
const useOrders = () => {}
const orderStore = create<OrderState>(...)
const MAX_ORDER_ITEMS = 100;
let isLoading = false;

// ❌ Bad: Unclear or inconsistent names
export default function Orders() {} // Should be OrdersListPage
export function OC({ o }: Props) {} // Should be OrderCard with proper props
const orders = () => {} // Should be useOrders
const store = create<State>(...) // Should be orderStore
const maxItems = 100; // Should be MAX_ORDER_ITEMS
let loading = false; // Should be isLoading
```

---

## Code Reuse Patterns

### 1. Extract Reusable Components

```typescript
// ✅ Good: Extract reusable component
// components/common/loading-indicator.tsx
export function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  );
}

// Usage across multiple pages
<LoadingIndicator />

// ❌ Bad: Inline component creation
<div className="flex items-center justify-center">
  <div className="animate-spin..." />
</div>
```

### 2. Extract Custom Hooks

```typescript
// ✅ Good: Reusable hook
// hooks/useOrders.ts
export function useOrders(tenantId: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    setIsLoading(true);
    fetchOrders(tenantId)
      .then(setOrders)
      .finally(() => setIsLoading(false));
  }, [tenantId]);
  
  return { orders, isLoading };
}

// Usage in multiple components
const { orders, isLoading } = useOrders(tenantId);

// ❌ Bad: Duplicate logic in components
function OrdersList() {
  const [orders, setOrders] = useState([]);
  // ... duplicate fetch logic
}
```

### 3. Extract Utility Functions

```typescript
// ✅ Good: Reusable utilities
// lib/utils/formatters.ts
export function formatCurrency(amount: number, locale: string = 'en'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: 'OMR',
  }).format(amount);
}

export function formatDate(date: Date, locale: string = 'en'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

// Usage
formatCurrency(25.50, locale)
formatDate(new Date(), locale)

// ❌ Bad: Inline formatting
new Intl.NumberFormat(...).format(amount) // Repeated everywhere
```

### 4. Extract Validation Schemas

```typescript
// ✅ Good: Reusable validation schemas
// lib/validations/order-schema.ts
import { z } from 'zod';

export const orderSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  items: z.array(z.object({
    serviceId: z.string().uuid(),
    quantity: z.number().min(1),
  })).min(1, 'At least one item required'),
  notes: z.string().optional(),
});

export type OrderFormData = z.infer<typeof orderSchema>;

// Usage in multiple forms
const { register, handleSubmit } = useForm<OrderFormData>({
  resolver: zodResolver(orderSchema),
});

// ❌ Bad: Duplicate validation logic
const validateOrder = (data: any) => {
  if (!data.customerId) return 'Customer required';
  // ... duplicate validation
};
```

### 5. Extract API Client Functions

```typescript
// ✅ Good: Centralized API functions
// lib/api/orders.ts
export async function getOrders(tenantId: string): Promise<Order[]> {
  const response = await fetch(`/api/v1/orders?tenant_id=${tenantId}`);
  if (!response.ok) throw new Error('Failed to fetch orders');
  return response.json();
}

export async function createOrder(order: CreateOrderDto): Promise<Order> {
  const response = await fetch('/api/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  if (!response.ok) throw new Error('Failed to create order');
  return response.json();
}

// Usage
const orders = await getOrders(tenantId);
const newOrder = await createOrder(orderData);

// ❌ Bad: Direct fetch calls in components
const response = await fetch('/api/v1/orders'); // Repeated everywhere
```

### 6. Extract Common Types

```typescript
// ✅ Good: Shared types
// types/order.ts
export interface Order {
  id: string;
  orderNumber: string;
  tenantId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'DELIVERED';

export interface CreateOrderDto {
  customerId: string;
  items: OrderItem[];
  notes?: string;
}

// Usage across multiple files
import type { Order, OrderStatus } from '@/types/order';

// ❌ Bad: Duplicate type definitions
interface Order { id: string; ... } // Defined in multiple files
```

### 7. Extract Constants

```typescript
// ✅ Good: Reusable constants
// constants/app.constants.ts
export const APP_CONSTANTS = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  MAX_ORDER_ITEMS: 100,
  DEFAULT_PAGE_SIZE: 20,
  SUPPORTED_LOCALES: ['en', 'ar'] as const,
} as const;

export const ORDER_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
} as const;

// Usage
const maxItems = APP_CONSTANTS.MAX_ORDER_ITEMS;
const status = ORDER_STATUSES.PENDING;

// ❌ Bad: Magic numbers/strings
const maxItems = 100; // What does 100 mean?
const status = 'PENDING'; // Typo-prone
```

### 8. Extract Server Actions

```typescript
// ✅ Good: Reusable server actions
// app/actions/orders.ts
'use server';

import { getTenantId } from '@/lib/auth/server-auth';
import { createOrder as createOrderService } from '@/lib/services/order-service';

export async function createOrder(formData: FormData) {
  const tenantId = await getTenantId();
  const orderData = {
    customerId: formData.get('customerId') as string,
    items: JSON.parse(formData.get('items') as string),
  };
  
  return await createOrderService(orderData, tenantId);
}

// Usage in multiple forms
import { createOrder } from '@/app/actions/orders';
await createOrder(formData);

// ❌ Bad: Duplicate server logic
// Repeated in multiple action files
```

### 9. Extract Common Layout Components

```typescript
// ✅ Good: Reusable layout components
// components/layouts/dashboard-layout.tsx
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

// Usage in multiple pages
export default function OrdersPage() {
  return (
    <DashboardLayout>
      <OrdersList />
    </DashboardLayout>
  );
}

// ❌ Bad: Duplicate layout code
// Layout code repeated in every page
```

### 10. Extract Zustand Store Patterns

```typescript
// ✅ Good: Reusable store pattern
// lib/stores/order-store.ts
import { create } from 'zustand';

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: (tenantId: string) => Promise<void>;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  isLoading: false,
  error: null,
  
  fetchOrders: async (tenantId: string) => {
    set({ isLoading: true, error: null });
    try {
      const orders = await getOrders(tenantId);
      set({ orders, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  addOrder: (order) => set((state) => ({ orders: [...state.orders, order] })),
  
  updateOrder: (id, updates) => set((state) => ({
    orders: state.orders.map((o) => o.id === id ? { ...o, ...updates } : o),
  })),
}));

// Usage
const { orders, fetchOrders } = useOrderStore();

// ❌ Bad: Local state management
const [orders, setOrders] = useState([]); // Not shared across components
```

---

## Learning Resources
- **Next.js Docs**: https://nextjs.org/docs
- **Tailwind Docs**: https://tailwindcss.com/docs
- **React Hook Form**: https://react-hook-form.com
- **Next.js Learn Course**: https://nextjs.org/learn (free, excellent)
