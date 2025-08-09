/**
 * Test the schema connector with imported schemas including Ideogram V3 Turbo
 */

import { 
  loadSchemaRegistry, 
  loadAPISchema, 
  getSchemaOperations, 
  listAvailableSchemas 
} from '@/lib/schema-connector';

/**
 * Test loading the schema registry
 */
export function testSchemaRegistry() {
  console.log('Testing schema registry...');
  
  try {
    const registry = loadSchemaRegistry();
    console.log('✅ Schema registry loaded successfully');
    console.log('Available schemas:', Object.keys(registry));
    
    // Check if key schemas are registered
    if (registry['openai-api']) {
      console.log('✅ OpenAI API schema found in registry');
      console.log('OpenAI schema info:', registry['openai-api']);
    } else {
      console.log('❌ OpenAI API schema not found in registry');
    }
    
    if (registry['ideogram-v3-turbo']) {
      console.log('✅ Ideogram V3 Turbo schema found in registry');
      console.log('Ideogram schema info:', registry['ideogram-v3-turbo']);
    } else {
      console.log('❌ Ideogram V3 Turbo schema not found in registry');
    }
    
    return registry;
  } catch (error) {
    console.error('❌ Error loading schema registry:', error);
    throw error;
  }
}

/**
 * Test loading the OpenAI API schema
 */
export function testOpenAISchema() {
  console.log('\nTesting OpenAI API schema loading...');
  
  try {
    const schema = loadAPISchema('openai-api');
    
    if (schema) {
      console.log('✅ OpenAI API schema loaded successfully');
      console.log('Schema info:', {
        title: schema.info.title,
        version: schema.info.version,
        description: schema.info.description,
        serverUrl: schema.servers[0]?.url
      });
      
      // Test getting operations
      const operations = getSchemaOperations(schema);
      console.log('✅ Operations extracted:', operations.length);
      operations.forEach(op => {
        console.log(`  - ${op.method} ${op.path} (${op.operationId})`);
        console.log(`    Summary: ${op.summary}`);
      });
      
      return schema;
    } else {
      console.log('❌ Failed to load OpenAI API schema');
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading OpenAI API schema:', error);
    throw error;
  }
}

/**
 * Test loading the Ideogram V3 Turbo schema
 */
export function testIdeogramSchema() {
  console.log('\nTesting Ideogram V3 Turbo schema loading...');
  
  try {
    const schema = loadAPISchema('ideogram-v3-turbo');
    
    if (schema) {
      console.log('✅ Ideogram V3 Turbo schema loaded successfully');
      console.log('Schema info:', {
        title: schema.info.title,
        version: schema.info.version,
        description: schema.info.description,
        serverUrl: schema.servers[0]?.url
      });
      
      // Test getting operations
      const operations = getSchemaOperations(schema);
      console.log('✅ Operations extracted:', operations.length);
      operations.forEach(op => {
        console.log(`  - ${op.method} ${op.path} (${op.operationId})`);
        console.log(`    Summary: ${op.summary}`);
      });
      
      // Check Replicate-specific metadata
      const metadata = (schema as { _metadata?: { replicateModel?: unknown } })._metadata;
      if (metadata?.replicateModel) {
        console.log('✅ Replicate metadata found:', metadata.replicateModel);
      }
      
      return schema;
    } else {
      console.log('❌ Failed to load Ideogram V3 Turbo schema');
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading Ideogram V3 Turbo schema:', error);
    throw error;
  }
}

/**
 * Test listing all available schemas
 */
export function testListSchemas() {
  console.log('\nTesting list available schemas...');
  
  try {
    const schemas = listAvailableSchemas();
    console.log('✅ Schema list generated successfully');
    console.log('Available schemas:');
    
    schemas.forEach(schema => {
      console.log(`  - ${schema.name} (${schema.id})`);
      console.log(`    Description: ${schema.description || 'No description'}`);
      console.log(`    Tools: ${schema.toolCount}`);
    });
    
    return schemas;
  } catch (error) {
    console.error('❌ Error listing schemas:', error);
    throw error;
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🧪 Running Schema Connector Tests for OpenAI API\n');
  
  try {
    // Test 1: Registry loading
    const registry = testSchemaRegistry();
    
    // Test 2: OpenAI schema loading
    const schema = testOpenAISchema();
    
    // Test 3: List all schemas
    const schemas = testListSchemas();
    
    console.log('\n✅ All tests completed successfully!');
    
    return {
      registry,
      schema,
      schemas
    };
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    throw error;
  }
}

// Export for easy testing in development
if (typeof window === 'undefined') {
  // Only run in Node.js environment (server-side)
  runAllTests().catch(console.error);
}