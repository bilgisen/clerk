/**
 * Safely access nested object properties
 * @param obj The object to access
 * @param path Dot-notation path to the property (e.g., 'user.profile.name')
 * @param defaultValue Value to return if the path doesn't exist
 * @returns The value at the specified path or the default value
 */
export function safeGet<T = any>(
  obj: any,
  path: string,
  defaultValue: T = undefined as any
): T {
  if (!obj || typeof obj !== 'object') return defaultValue;
  
  try {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      result = result?.[key];
      if (result === undefined || result === null) {
        return defaultValue;
      }
    }
    
    return result !== undefined ? result : defaultValue;
  } catch (error) {
    console.error(`Error accessing path '${path}':`, error);
    return defaultValue;
  }
}

/**
 * Safely set a nested property on an object
 * @param obj The object to modify
 * @param path Dot-notation path to the property
 * @param value The value to set
 * @returns The modified object
 */
export function safeSet<T = any>(
  obj: any,
  path: string,
  value: T
): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  try {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return obj;
  } catch (error) {
    console.error(`Error setting path '${path}':`, error);
    return obj;
  }
}

/**
 * Debug function to log the shape of an object safely
 * @param obj The object to debug
 * @param name Optional name for the debug log
 */
export function debugObject(obj: any, name = 'Object'): void {
  if (process.env.NODE_ENV === 'production') return;
  
  console.group(`🔍 ${name} Debug`);
  
  if (obj === null) {
    console.log('Value is null');
  } else if (obj === undefined) {
    console.log('Value is undefined');
  } else if (typeof obj !== 'object') {
    console.log('Primitive value:', obj);
  } else {
    console.log('Type:', obj.constructor?.name || typeof obj);
    
    // Safely get object keys
    let keys: string[] = [];
    try {
      keys = Object.keys(obj);
    } catch (e) {
      console.warn('Could not get object keys:', e);
    }
    
    if (keys.length === 0) {
      console.log('No enumerable properties');
    } else {
      console.log('Properties:', keys);
      
      // For a small number of properties, log their types
      if (keys.length <= 10) {
        keys.forEach(key => {
          try {
            const value = obj[key];
            console.log(
              `- ${key}:`,
              value === null ? 'null' :
              value === undefined ? 'undefined' :
              typeof value === 'object' ? `{${Object.keys(value || {}).join(', ')}}` :
              typeof value === 'function' ? 'function' :
              value
            );
          } catch (e) {
            console.warn(`Could not access property '${key}':`, e);
          }
        });
      }
    }
  }
  
  console.groupEnd();
}
