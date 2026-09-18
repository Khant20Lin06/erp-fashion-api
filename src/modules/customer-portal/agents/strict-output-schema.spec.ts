import { z } from 'zod';
import { strictOutputSchema } from './strict-output-schema';

describe('strict provider output schema', () => {
  it('requires optional properties on the wire as nullable without changing domain output', () => {
    const original = z
      .object({
        route: z.enum(['sales', 'direct']),
        directKind: z.enum(['greeting', 'clarify']).optional(),
      })
      .strict();
    const wire = strictOutputSchema(original);
    expect(z.toJSONSchema(wire.schema).required).toEqual([
      'route',
      'directKind',
    ]);
    expect(wire.schema.safeParse({ route: 'sales' }).success).toBe(false);
    expect(
      wire.decode(wire.schema.parse({ route: 'sales', directKind: null })),
    ).toEqual({ route: 'sales' });
    expect(wire.decode({ route: 'direct', directKind: 'greeting' })).toEqual({
      route: 'direct',
      directKind: 'greeting',
    });
  });
  it('retains validation and required nullable values', () => {
    const wire = strictOutputSchema(
      z
        .object({
          value: z.string().nullable(),
          quantity: z.number().int().min(1).max(999).optional(),
        })
        .strict(),
    );
    expect(wire.decode({ value: null, quantity: null })).toEqual({
      value: null,
    });
    expect(() => wire.decode({ value: null, quantity: 1000 })).toThrow();
    expect(() => wire.decode({ value: null, unknown: 'injected' })).toThrow();
  });
});
