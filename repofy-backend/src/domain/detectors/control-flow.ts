import * as ts from "typescript";

function booleanLiteral(expression: ts.Expression): boolean | undefined {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)
    || ts.isNonNullExpression(expression) || ts.isSatisfiesExpression(expression)) expression = expression.expression;
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken) {
    const value = booleanLiteral(expression.operand); return value === undefined ? undefined : !value;
  }
  return undefined;
}

/** Bounded lexical reachability, not a proof that a function executes or an operation succeeds. */
export class ControlFlow {
  private readonly exits = new Map<ts.Statement, boolean>();
  private readonly lists = new Map<ts.Node, Set<ts.Statement>>();
  private readonly nodes = new Map<ts.Node, boolean>();
  constructor(private readonly parents: ReadonlyMap<ts.Node, ts.Node>, private readonly tick: () => void) {}

  private stops(statement: ts.Statement): boolean {
    this.tick();
    const cached = this.exits.get(statement); if (cached !== undefined) return cached;
    let value = ts.isReturnStatement(statement) || ts.isThrowStatement(statement) || ts.isBreakStatement(statement) || ts.isContinueStatement(statement);
    if (ts.isBlock(statement)) value = statement.statements.some(s => this.stops(s));
    if (ts.isIfStatement(statement)) {
      const condition = booleanLiteral(statement.expression);
      value = condition === true ? this.stops(statement.thenStatement) : condition === false
        ? !!statement.elseStatement && this.stops(statement.elseStatement)
        : !!statement.elseStatement && this.stops(statement.thenStatement) && this.stops(statement.elseStatement);
    }
    if (ts.isTryStatement(statement)) value = !!statement.finallyBlock && this.stops(statement.finallyBlock)
      || this.stops(statement.tryBlock) && (!statement.catchClause || this.stops(statement.catchClause.block));
    this.exits.set(statement, value); return value;
  }

  statements(body: ts.Block | ts.SourceFile | ts.CaseOrDefaultClause): ReadonlySet<ts.Statement> {
    this.tick();
    let statements = this.lists.get(body);
    if (!statements) {
      statements = new Set();
      for (const statement of body.statements) { statements.add(statement); if (this.stops(statement)) break; }
      this.lists.set(body, statements);
    }
    return statements;
  }

  reachable(node: ts.Node): boolean {
    this.tick();
    const cached = this.nodes.get(node); if (cached !== undefined) return cached;
    const parent = this.parents.get(node);
    if (!parent) { this.nodes.set(node, true); return true; }
    let value = this.reachable(parent);
    if (value) {
      if ((ts.isBlock(parent) || ts.isSourceFile(parent) || ts.isCaseClause(parent) || ts.isDefaultClause(parent)) && ts.isStatement(node)) {
        // Declarations can be hoisted past a return in an entered block. Function
        // expressions still require reachable creation, and declarations inside
        // a dead block cannot make that block's contents reachable.
        value = ts.isFunctionDeclaration(node) || this.statements(parent).has(node);
      } else if (ts.isIfStatement(parent)) {
        const condition = booleanLiteral(parent.expression);
        if (node === parent.thenStatement && condition === false || node === parent.elseStatement && condition === true) value = false;
      } else if (ts.isConditionalExpression(parent)) {
        const condition = booleanLiteral(parent.condition);
        if (node === parent.whenTrue && condition === false || node === parent.whenFalse && condition === true) value = false;
      } else if (ts.isWhileStatement(parent) || ts.isForStatement(parent)) {
        // The loop initializer/condition may execute even when its body cannot.
        const condition = ts.isWhileStatement(parent) ? parent.expression : parent.condition;
        if (condition && booleanLiteral(condition) === false && (node === parent.statement || ts.isForStatement(parent) && node === parent.incrementor)) value = false;
      } else if (ts.isBinaryExpression(parent) && node === parent.right) {
        const condition = booleanLiteral(parent.left), operator = parent.operatorToken.kind;
        if (condition === false && operator === ts.SyntaxKind.AmpersandAmpersandToken
          || condition === true && operator === ts.SyntaxKind.BarBarToken
          || condition !== undefined && operator === ts.SyntaxKind.QuestionQuestionToken) value = false;
      }
    }
    this.nodes.set(node, value); return value;
  }
}
