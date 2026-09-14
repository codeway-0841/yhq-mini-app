export { ExprError, type ExprErrorCode } from './errors'
export {
  normalizeExpression,
  normalizeWithMap,
  mapNormalizedPosition,
  type NormalizedExpression,
} from './normalize'
export { tokenize, type Token, type TokenType } from './tokenize'
export { parseExpression, collectVars, type ExprNode, type ParsedExpression, type BinaryOp } from './parse'
export { compileAst, compileExpression, type CompiledExpression, type Scope } from './compile'
export { FUNCTIONS, CONSTANTS, FUNCTION_NAMES, isFunctionName, isConstantName, type BuiltinFunction } from './builtins'
export {
  derivativeAt,
  makeDerivative,
  integrate,
  riemann,
  type RiemannResult,
} from './calculus'
export { astToLatex, expressionToLatex, graphExpressionToLatex } from './latex'
export {
  parseGraphExpression,
  splitTopLevel,
  axisVarsOf,
  type ParsedGraphExpression,
  type GraphExprKind,
  type Relation,
} from './graph-expr'
export {
  findRoots,
  findExtrema,
  findIntersections,
  analyzeCurves,
  type MarkerKind,
  type MarkerPoint,
  type ExtremaPoint,
  type CurveEntry,
} from './analysis'
