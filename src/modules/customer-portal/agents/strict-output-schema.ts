import { z } from 'zod';

// OpenAI-compatible strict output requires every property in `required`.
// Our flat route/action contracts use optional fields; encode absence as null
// only on the provider wire, then restore the original validated contract.
export function strictOutputSchema(original: z.ZodType) {
  if (!(original instanceof z.ZodObject)) {
    return {
      schema: original,
      decode: (value: unknown) => original.parse(value),
    };
  }
  const shape: Record<string, z.ZodType> = {};
  const optional = new Set<string>();
  for (const [key, field] of Object.entries(original.shape)) {
    if (!(field instanceof z.ZodType))
      throw new Error('Invalid output field schema');
    if (field.isOptional()) {
      optional.add(key);
      shape[key] = field.nonoptional().nullable();
    } else shape[key] = field;
  }
  const schema = z.object(shape).strict();
  return {
    schema,
    decode: (value: unknown) => {
      const parsed = schema.parse(value);
      return original.parse(
        Object.fromEntries(
          Object.entries(parsed).filter(
            ([key, entry]) => entry !== null || !optional.has(key),
          ),
        ),
      );
    },
  };
}
