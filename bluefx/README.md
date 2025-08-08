# BlueFX AI Platform

A comprehensive AI-powered platform for content creation with full TypeScript integration and type safety.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Generate types from database schema
npm run types:generate

# Start development server
npm run dev

# Or start with type watching
npm run dev:types
```

## 📚 Documentation

- **[TypeScript Integration Guide](./docs/typescript-integration-guide.md)** - Complete guide for the TypeScript integration system
- **[Quick Reference](./docs/quick-reference.md)** - Common patterns and code snippets

## 🏗️ Architecture

### Type-Safe Foundation

This project uses a comprehensive TypeScript integration system that provides:

- **Database Types**: Auto-generated from your Supabase schema
- **Runtime Validation**: Zod schemas for all data validation
- **Type-Safe Operations**: Fully typed database queries and mutations
- **Automated Testing**: Comprehensive type safety validation

### Key Components

```
/types/           # Auto-generated & validation types
/lib/database/    # Type-safe database operations
/lib/validation/  # Runtime validation service
/app/actions/     # Type-safe server actions
/app/supabase/    # Type-safe Supabase clients
```

## 🔧 Development

### Available Scripts

```bash
# Type Management
npm run types:generate    # Generate types from schema
npm run types:check      # Check TypeScript compilation
npm run types:validate   # Full validation suite
npm run types:watch      # Watch for changes

# Development
npm run dev             # Start development server
npm run dev:types       # Generate types + start dev server
npm run build          # Build for production
npm run lint           # Run ESLint
```

### Development Workflow

1. **Make schema changes** (if needed)
2. **Generate types**: `npm run types:generate`
3. **Add validation schemas** to `/types/validation.ts`
4. **Create server actions** using existing patterns
5. **Build components** with type-safe props
6. **Test**: `npm run types:validate`

## 🎯 Key Features

### Type Safety
- 100% TypeScript coverage
- No `any` types
- Auto-generated database types
- Runtime type validation

### Database Operations
- Type-safe query builder
- Automatic error handling
- Credit management system
- User analytics

### Authentication
- Type-safe auth actions
- Subscription management
- Profile management
- Session handling

### Validation
- Zod schema validation
- Form data validation
- API response validation
- Credit usage validation

## 📝 Common Patterns

### Server Actions

```typescript
'use server'

import { ValidationService, createApiSuccess, createApiError } from '@/lib/validation'
import { databaseService } from '@/lib/database'

export async function myAction(formData: FormData) {
  try {
    // 1. Validate
    const validation = ValidationService.validateFormData(MySchema, formData)
    if (!validation.success) {
      return createApiError(validation.error)
    }

    // 2. Database operation
    const result = await databaseService.server.doSomething(validation.data)
    
    // 3. Return
    return createApiSuccess(result)
  } catch (error) {
    return createApiError(error instanceof Error ? error.message : 'Error')
  }
}
```

### Components

```typescript
import { Tables } from '@/types/database'

interface Props {
  user: Tables<'profiles'>
  items: Tables<'my_table'>[]
}

export function MyComponent({ user, items }: Props) {
  return (
    <div>
      <h1>{user.username}</h1>
      {items.map(item => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  )
}
```

## 🔍 Testing

### Type Safety Validation

```bash
# Run comprehensive type safety tests
npx tsx scripts/validate-typescript-integration.ts

# Run specific validations
npm run typecheck
npm run lint
```

### Manual Testing

```typescript
import { typeSafetyValidator } from '@/lib/testing/type-safety-validator'

const results = await typeSafetyValidator.runAllTests()
console.log(results)
```

## 🛠️ Configuration

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_PROJECT_ID=your_project_id
```

### TypeScript Configuration

The project uses strict TypeScript configuration:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

## 📊 Monitoring

### Performance Monitoring

```typescript
// Get user analytics
const analytics = await databaseService.getDetailedUserAnalytics(userId)

// Monitor credit usage
const usage = await databaseService.server.getCreditUsageHistory(userId)
```

### Type Safety Monitoring

```bash
# Continuous type checking
npm run types:watch

# Validation reports
npm run types:validate
```

## 🔄 Maintenance

### Schema Updates

```bash
# After updating your database schema
npm run types:generate
npm run types:validate
```

### Adding New Features

1. Update schema (if needed)
2. Generate types: `npm run types:generate`
3. Add validation schemas
4. Create database operations
5. Build server actions
6. Create components
7. Test: `npm run types:validate`

## 🤝 Contributing

1. Follow the established TypeScript patterns
2. Use the validation service for all data validation
3. Use the database service for all database operations
4. Run `npm run types:validate` before committing
5. Update documentation for new features

## 📄 License

This project is private and proprietary.

---

## 💡 Pro Tips

- Use `Tables<'table_name'>` for database types
- Always validate input with `ValidationService`
- Use `databaseService` for all database operations
- Follow the error handling patterns
- Run type generation after schema changes
- Use the type watcher during development

For detailed information, see the [TypeScript Integration Guide](./docs/typescript-integration-guide.md).