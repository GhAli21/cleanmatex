# NestJS Module Template

## 📁 Folder Structure

```
src/modules/{module-name}/
├── {module-name}.module.ts
├── {module-name}.controller.ts
├── {module-name}.service.ts
├── {module-name}.controller.spec.ts
├── {module-name}.service.spec.ts
├── dto/
│   ├── create-{entity}.dto.ts
│   ├── update-{entity}.dto.ts
│   └── {entity}-filters.dto.ts
└── entities/
    └── {entity}.entity.ts (if needed)
```

---

## 📝 Module File Template

**File**: `{module-name}.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { {ModuleName}Controller } from './{module-name}.controller';
import { {ModuleName}Service } from './{module-name}.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [{ModuleName}Controller],
  providers: [{ModuleName}Service],
  exports: [{ModuleName}Service], // Export if used by other modules
})
export class {ModuleName}Module {}
```

---

## 🎮 Controller Template

**File**: `{module-name}.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { {ModuleName}Service } from './{module-name}.service';
import { Create{Entity}Dto } from './dto/create-{entity}.dto';
import { Update{Entity}Dto } from './dto/update-{entity}.dto';
import { {Entity}FiltersDto } from './dto/{entity}-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('{entities}')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('{entities}')
export class {ModuleName}Controller {
  constructor(private readonly {moduleName}Service: {ModuleName}Service) {}

  @Post()
  @ApiOperation({ summary: 'Create a new {entity}' })
  @ApiResponse({ status: 201, description: '{Entity} created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @Body() createDto: Create{Entity}Dto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.{moduleName}Service.create(createDto, tenantId, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all {entities} with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of {entities}' })
  findAll(
    @Query() filters: {Entity}FiltersDto,
    @TenantId() tenantId: string,
  ) {
    return this.{moduleName}Service.findAll(filters, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get {entity} by ID' })
  @ApiResponse({ status: 200, description: '{Entity} found' })
  @ApiResponse({ status: 404, description: '{Entity} not found' })
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.{moduleName}Service.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update {entity}' })
  @ApiResponse({ status: 200, description: '{Entity} updated successfully' })
  @ApiResponse({ status: 404, description: '{Entity} not found' })
  update(
    @Param('id') id: string,
    @Body() updateDto: Update{Entity}Dto,
    @TenantId() tenantId: string,
  ) {
    return this.{moduleName}Service.update(id, updateDto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete {entity}' })
  @ApiResponse({ status: 200, description: '{Entity} deleted successfully' })
  @ApiResponse({ status: 404, description: '{Entity} not found' })
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.{moduleName}Service.remove(id, tenantId);
  }
}
```

---

## 🔧 Service Template

**File**: `{module-name}.service.ts`

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Create{Entity}Dto } from './dto/create-{entity}.dto';
import { Update{Entity}Dto } from './dto/update-{entity}.dto';
import { {Entity}FiltersDto } from './dto/{entity}-filters.dto';

@Injectable()
export class {ModuleName}Service {
  private readonly logger = new Logger({ModuleName}Service.name);

  constructor(private prisma: PrismaService) {}

  async create(
    createDto: Create{Entity}Dto,
    tenantId: string,
    userId: string,
  ) {
    this.logger.log(`Creating {entity} for tenant ${tenantId}`);

    try {
      const {entity} = await this.prisma.{entity}.create({
        data: {
          ...createDto,
          tenantOrgId: tenantId,
          createdBy: userId,
        },
        include: {
          // Include related entities if needed
        },
      });

      this.logger.log(`{Entity} created: ${entity}.id`);
      return {entity};
    } catch (error) {
      this.logger.error(
        `Failed to create {entity}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findAll(filters: {Entity}FiltersDto, tenantId: string) {
    const { page = 1, limit = 20, search, status } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenantOrgId: tenantId, // CRITICAL: Always filter by tenant
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Execute query with pagination
    const [{entities}, total] = await Promise.all([
      this.prisma.{entity}.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          // Include related entities
        },
      }),
      this.prisma.{entity}.count({ where }),
    ]);

    return {
      data: {entities},
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const {entity} = await this.prisma.{entity}.findUnique({
      where: {
        id,
        tenantOrgId: tenantId, // CRITICAL: Filter by tenant
      },
      include: {
        // Include related entities
      },
    });

    if (!{entity}) {
      throw new NotFoundException(`{Entity} with ID ${id} not found`);
    }

    return {entity};
  }

  async update(
    id: string,
    updateDto: Update{Entity}Dto,
    tenantId: string,
  ) {
    // Verify {entity} exists and belongs to tenant
    await this.findOne(id, tenantId);

    const {entity} = await this.prisma.{entity}.update({
      where: {
        id,
        tenantOrgId: tenantId, // CRITICAL: Filter by tenant
      },
      data: updateDto,
      include: {
        // Include related entities
      },
    });

    this.logger.log(`{Entity} updated: ${id}`);
    return {entity};
  }

  async remove(id: string, tenantId: string) {
    // Verify {entity} exists and belongs to tenant
    await this.findOne(id, tenantId);

    // Soft delete (recommended) or hard delete
    const {entity} = await this.prisma.{entity}.update({
      where: {
        id,
        tenantOrgId: tenantId, // CRITICAL: Filter by tenant
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // For hard delete, use:
    // await this.prisma.{entity}.delete({
    //   where: { id, tenantOrgId: tenantId },
    // });

    this.logger.log(`{Entity} deleted: ${id}`);
    return { message: '{Entity} deleted successfully' };
  }
}
```

---

## 📦 DTO Templates

### Create DTO

**File**: `dto/create-{entity}.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class Create{Entity}Dto {
  @ApiProperty({ description: 'Entity name', example: 'Example Name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Entity description',
    required: false,
    example: 'Optional description',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'Related entity UUID', example: 'uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  relatedEntityId: string;

  // Add more fields as needed
}
```

### Update DTO

**File**: `dto/update-{entity}.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { Create{Entity}Dto } from './create-{entity}.dto';

export class Update{Entity}Dto extends PartialType(Create{Entity}Dto) {}
```

### Filters DTO

**File**: `dto/{entity}-filters.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class {Entity}FiltersDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'PENDING'],
  })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'PENDING'])
  status?: string;
}
```

---

## 🧪 Test Templates

### Service Unit Test

**File**: `{module-name}.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { {ModuleName}Service } from './{module-name}.service';
import { PrismaService } from '../prisma/prisma.service';

describe('{ModuleName}Service', () => {
  let service: {ModuleName}Service;
  let prisma: PrismaService;

  const mockPrismaService = {
    {entity}: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {ModuleName}Service,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<{ModuleName}Service>({ModuleName}Service);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a {entity} with tenant filtering', async () => {
      const createDto = {
        name: 'Test {Entity}',
        description: 'Test Description',
      };
      const tenantId = 'tenant-uuid';
      const userId = 'user-uuid';

      const expected{Entity} = {
        id: 'uuid',
        ...createDto,
        tenantOrgId: tenantId,
        createdBy: userId,
        createdAt: new Date(),
      };

      mockPrismaService.{entity}.create.mockResolvedValue(expected{Entity});

      const result = await service.create(createDto, tenantId, userId);

      expect(result).toEqual(expected{Entity});
      expect(mockPrismaService.{entity}.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          tenantOrgId: tenantId,
          createdBy: userId,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated {entities} filtered by tenant', async () => {
      const tenantId = 'tenant-uuid';
      const filters = { page: 1, limit: 20 };

      const mock{Entities} = [
        { id: '1', name: '{Entity} 1', tenantOrgId: tenantId },
        { id: '2', name: '{Entity} 2', tenantOrgId: tenantId },
      ];

      mockPrismaService.{entity}.findMany.mockResolvedValue(mock{Entities});
      mockPrismaService.{entity}.count.mockResolvedValue(2);

      const result = await service.findAll(filters, tenantId);

      expect(result.data).toEqual(mock{Entities});
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('should return a {entity} if found', async () => {
      const id = 'uuid';
      const tenantId = 'tenant-uuid';
      const mock{Entity} = { id, name: 'Test', tenantOrgId: tenantId };

      mockPrismaService.{entity}.findUnique.mockResolvedValue(mock{Entity});

      const result = await service.findOne(id, tenantId);

      expect(result).toEqual(mock{Entity});
    });

    it('should throw NotFoundException if {entity} not found', async () => {
      mockPrismaService.{entity}.findUnique.mockResolvedValue(null);

      await expect(service.findOne('uuid', 'tenant-uuid')).rejects.toThrow(
        'not found',
      );
    });
  });

  describe('update', () => {
    it('should update a {entity}', async () => {
      const id = 'uuid';
      const tenantId = 'tenant-uuid';
      const updateDto = { name: 'Updated Name' };
      const existing{Entity} = { id, name: 'Old Name', tenantOrgId: tenantId };
      const updated{Entity} = { ...existing{Entity}, ...updateDto };

      mockPrismaService.{entity}.findUnique.mockResolvedValue(existing{Entity});
      mockPrismaService.{entity}.update.mockResolvedValue(updated{Entity});

      const result = await service.update(id, updateDto, tenantId);

      expect(result).toEqual(updated{Entity});
    });
  });
});
```

---

## ✅ Checklist When Creating New Module

- [ ] Create folder structure
- [ ] Generate module, controller, service
- [ ] Create DTOs with validation
- [ ] Implement service with tenant filtering
- [ ] Add controller endpoints
- [ ] Add Swagger documentation
- [ ] Write unit tests (aim for 80%+ coverage)
- [ ] Add integration tests
- [ ] Register module in app.module.ts
- [ ] Update API documentation
- [ ] Test manually with Postman/Thunder Client

---

**Last Updated**: 2025-01-09
