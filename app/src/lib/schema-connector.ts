/**
 * Schema Connector Utilities
 * Helper functions for working with imported API schemas
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface SchemaRegistry {
  [key: string]: {
    id: string;
    name: string;
    url: string;
    toolCount: number;
    description?: string;
    type?: string;
    lastUpdated: string;
  };
}

export interface APISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
}

/**
 * Load the schema registry
 */
export function loadSchemaRegistry(): SchemaRegistry {
  try {
    const registryPath = join(process.cwd(), 'schema-data', 'index.json');
    const registryContent = readFileSync(registryPath, 'utf-8');
    return JSON.parse(registryContent);
  } catch (error) {
    console.warn('Could not load schema registry:', error);
    return {};
  }
}

/**
 * Load a specific API schema by ID
 */
export function loadAPISchema(schemaId: string): APISchema | null {
  try {
    const schemaPath = join(process.cwd(), 'schema-data', 'schemas', `${schemaId}.json`);
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    return JSON.parse(schemaContent);
  } catch (error) {
    console.warn(`Could not load schema ${schemaId}:`, error);
    return null;
  }
}

/**
 * Get available operations from a schema
 */
export function getSchemaOperations(schema: APISchema): Array<{
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
}> {
  const operations: Array<{
    operationId: string;
    method: string;
    path: string;
    summary?: string;
    description?: string;
  }> = [];

  for (const [path, pathItem] of Object.entries(schema.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem as Record<string, unknown>)) {
      if (typeof operation === 'object' && operation !== null && 'operationId' in operation) {
        const operationObj = operation as {
          operationId?: string;
          summary?: string;
          description?: string;
        };
        operations.push({
          operationId: operationObj.operationId || `${method}_${path}`,
          method: method.toUpperCase(),
          path,
          summary: operationObj.summary || undefined,
          description: operationObj.description || undefined,
        });
      }
    }
  }

  return operations;
}

/**
 * List all available schemas
 */
export function listAvailableSchemas(): Array<{
  id: string;
  name: string;
  description?: string;
  toolCount: number;
}> {
  const registry = loadSchemaRegistry();
  
  return Object.values(registry).map(schema => ({
    id: schema.id,
    name: schema.name,
    description: schema.description,
    toolCount: schema.toolCount,
  }));
}