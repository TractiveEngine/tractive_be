import type { ComponentType } from 'react';

declare module 'swagger-ui-react' {
  const SwaggerUI: ComponentType<Record<string, unknown>>;
  export default SwaggerUI;
}
