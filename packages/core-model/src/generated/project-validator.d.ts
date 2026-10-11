import type { ProjectDoc } from '../types';
interface ShapeValidator {
  (value: unknown): value is ProjectDoc;
  errors?: { instancePath: string; message?: string; keyword: string }[] | null;
}
declare const validate: ShapeValidator;
export default validate;
