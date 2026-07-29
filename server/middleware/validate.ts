/**
 * Zod-based request validation middleware factory.
 *
 * Usage:
 *   router.post('/init', validate({ body: InitSchema }), wrap(handler))
 *
 * On failure returns 400 with { error: string, details: ZodIssue[] }.
 * On success, req.body / req.params / req.query are replaced with parsed values.
 */

import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

interface Schemas {
  body?:   ZodSchema
  params?: ZodSchema
  query?:  ZodSchema
}

export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body)   req.body   = schemas.body.parse(req.body)
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params
      if (schemas.query)  req.query  = schemas.query.parse(req.query)   as typeof req.query
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error:   'Validation failed',
          details: err.issues,
        })
        return
      }
      next(err)
    }
  }
}
