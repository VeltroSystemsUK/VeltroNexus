import { Type } from '@sinclair/typebox';

/**
 * Standard ARES Frame Schema
 */
export const AresFrameSchema = Type.Object({
    id: Type.String(),
    type: Type.Union([
        Type.Literal('USER_MESSAGE'),
        Type.Literal('SYSTEM_DIRECTIVE'),
        Type.Literal('TOOL_CALL'),
        Type.Literal('HEALTH_CHECK')
    ]),
    payload: Type.Any(),
    metadata: Type.Object({
        source: Type.String(),
        timestamp: Type.String(),
        sessionId: Type.Optional(Type.String())
    })
});

export const AresResponseSchema = Type.Object({
    success: Type.Boolean(),
    message: Type.String(),
    data: Type.Optional(Type.Any()),
    error: Type.Optional(Type.String())
});
