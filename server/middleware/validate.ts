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
      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params)
        Object.assign(req.params, parsedParams)
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query)
        Object.assign(req.query, parsedQuery)
      }
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
