'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UndefinedCheckerProps {
  /** The object to check for undefined properties */
  obj: any;
  /** Optional name for the object in logs */
  name?: string;
  /** Whether to log object structure on mount */
  logOnMount?: boolean;
  /** Whether to throw an error if undefined properties are found */
  throwOnUndefined?: boolean;
  /** Additional data to include in logs */
  context?: Record<string, any>;
}

/**
 * Component that helps track down undefined property access
 * Will log warnings when undefined properties are accessed
 */
export function UndefinedChecker({
  obj,
  name = 'object',
  logOnMount = true,
  throwOnUndefined = false,
  context = {},
}: UndefinedCheckerProps) {
  const proxyRef = useRef<any>(null);
  const accessedPaths = useRef<Set<string>>(new Set());
  const undefinedPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!obj || typeof obj !== 'object') {
      console.warn(`[UndefinedChecker] ${name} is not an object:`, obj);
      return;
    }

    if (logOnMount) {
      console.log(`[UndefinedChecker] Checking ${name}:`, {
        type: obj?.constructor?.name || typeof obj,
        keys: Object.keys(obj || {}),
        ...context,
      });
    }

    // Create a proxy to track property access
    const handler: ProxyHandler<any> = {
      get(target, prop, receiver) {
        const path = `${name}.${String(prop)}`;
        
        // Track that this path was accessed
        if (!accessedPaths.current.has(path)) {
          accessedPaths.current.add(path);
          
          // Check if the property is undefined
          const value = Reflect.get(target, prop, receiver);
          if (value === undefined) {
            undefinedPaths.current.add(path);
            
            const errorMessage = `[UndefinedChecker] Undefined access: ${path}`;
            const errorInfo = {
              path,
              target,
              prop,
              context: {
                ...context,
                allUndefinedPaths: Array.from(undefinedPaths.current),
                allAccessedPaths: Array.from(accessedPaths.current)
              },
              stack: new Error().stack
            };
            
            console.warn(errorMessage, errorInfo);
            
            if (throwOnUndefined) {
              throw new Error(`${errorMessage}\n${JSON.stringify(errorInfo, null, 2)}`);
            }
          }
        }
        
        // Return a proxy for nested objects
        const value = Reflect.get(target, prop, receiver);
        if (value !== null && typeof value === 'object') {
          return new Proxy(value, {
            ...handler,
            get: (nestedTarget, nestedProp, nestedReceiver) => {
              const nestedPath = `${path}.${String(nestedProp)}`;
              accessedPaths.current.add(nestedPath);
              
              const nestedValue = Reflect.get(nestedTarget, nestedProp, nestedReceiver);
              
              if (nestedValue === undefined) {
                undefinedPaths.current.add(nestedPath);
                
                const errorMessage = `[UndefinedChecker] Undefined access: ${nestedPath}`;
                const errorInfo = {
                  path: nestedPath,
                  target: nestedTarget,
                  prop: nestedProp,
                  context: {
                    ...context,
                    allUndefinedPaths: Array.from(undefinedPaths.current),
                    allAccessedPaths: Array.from(accessedPaths.current)
                  },
                  stack: new Error().stack
                };
                
                console.warn(errorMessage, errorInfo);
                
                if (throwOnUndefined) {
                  throw new Error(`${errorMessage}\n${JSON.stringify(errorInfo, null, 2)}`);
                }
              }
              
              return nestedValue;
            }
          });
        }
        
        return value;
      },
    };

    proxyRef.current = new Proxy(obj, handler);

    // Cleanup function to log all undefined accesses when component unmounts
    return () => {
      if (undefinedPaths.current.size > 0) {
        console.group(`[UndefinedChecker] Summary for ${name}`);
        console.log('Undefined paths:', Array.from(undefinedPaths.current));
        console.log('All accessed paths:', Array.from(accessedPaths.current));
        console.log('Context:', context);
        console.groupEnd();
      }
    };
  }, [obj, name, logOnMount, throwOnUndefined, context]);

  // Return the original object in production to avoid performance overhead
  if (process.env.NODE_ENV === 'production') {
    return obj;
  }

  return proxyRef.current || obj;
}

/**
 * Creates a proxy for an object to track undefined property access
 */
function createProxy<T extends object>(
  obj: T,
  name: string,
  options: Omit<UndefinedCheckerProps, 'obj' | 'name'>
): T {
  const { logOnMount = true, throwOnUndefined = false, context = {} } = options;
  const accessedPaths = new Set<string>();
  const undefinedPaths = new Set<string>();

  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      const propStr = String(prop);
      const path = name ? `${name}.${propStr}` : propStr;
      
      // Skip special properties
      if (prop === '$$typeof' || prop === 'prototype' || prop === 'constructor') {
        return Reflect.get(target, prop, receiver);
      }

      const value = Reflect.get(target, prop, receiver);
      
      if (value === undefined || value === null) {
        const error = new Error(`Undefined property accessed: ${path}`);
        console.warn(`[UndefinedChecker] ${error.message}`, { 
          path,
          target,
          ...context 
        });
        
        undefinedPaths.add(path);
        
        if (throwOnUndefined) {
          throw error;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively proxy nested objects
        return createProxy(value, path, options);
      }
      
      accessedPaths.add(path);
      return value;
    }
  };

  return new Proxy(obj, handler);
}

/**
 * Higher-order component that wraps a component with UndefinedChecker
 * for all props
 */
export function withUndefinedCheck<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<UndefinedCheckerProps, 'obj' | 'name'> & { componentName?: string } = {}
) {
  const { componentName = Component.displayName || Component.name || 'Component', ...restOptions } = options;
  
  const WrappedComponent = (props: P) => {
    // Create a proxy for each prop that's an object
    const checkedProps = Object.entries(props).reduce((acc, [key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        acc[key] = createProxy(value, key, restOptions);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    return <Component {...(checkedProps as P)} />;
  };

  // Copy static properties
  Object.assign(WrappedComponent, Component);
  
  // Set display name for debugging
  WrappedComponent.displayName = `withUndefinedCheck(${componentName})`;
  
  return WrappedComponent;
}

/**
 * Hook that returns a function to check for undefined properties
 * in an object
 */
export function useUndefinedChecker(name: string = 'object') {
  const checkUndefined = (obj: any, path: string = '') => {
    if (obj === undefined || obj === null) {
      console.warn(`[UndefinedChecker] ${name}${path} is ${obj}`);
      return true;
    }

    if (typeof obj !== 'object') {
      return false;
    }

    let hasUndefined = false;
    for (const key in obj) {
      const value = obj[key];
      const fullPath = path ? `${path}.${key}` : key;
      
      if (value === undefined) {
        console.warn(`[UndefinedChecker] ${name}${fullPath} is undefined`);
        hasUndefined = true;
      } else if (value && typeof value === 'object') {
        if (checkUndefined(value, fullPath)) {
          hasUndefined = true;
        }
      }
    }
    
    return hasUndefined;
  };

  return { checkUndefined };
}
