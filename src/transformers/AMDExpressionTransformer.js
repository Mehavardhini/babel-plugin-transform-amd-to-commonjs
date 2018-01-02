'use strict';

const { REQUIRE, MODULE, EXPORTS } = require('../constants');
const { createRequireExpression } = require('../helpers');

// Simple version of zip that only pairs elements until the end of the first array
const zip = (array1, array2) => {
  return array1.map((element, index) => [element, array2[index]]);
};

// Order is important here for the simplified commonjs wrapper
const keywords = [REQUIRE, EXPORTS, MODULE];

class AMDExpressionTransformer {
  constructor(t, path) {
    this.t = t;
    this.path = path;
  }

  isTransformableAMDExpression() {
    return this.t.isArrayExpression(this.getDependencyList()) || this.getFactory();
  }

  getArguments() {
    return this.path.node.expression.arguments;
  }

  getDependencyList() {}

  getFactory() {}

  getFactoryArity() {
    return this.getFactory().params.length;
  }

  hasFunctionFactory() {
    return this.t.isFunctionExpression(this.getFactory());
  }

  getCommonJSRequireExpressions() {
    const dependencyList = this.getDependencyList();

    if (dependencyList) {
      const dependencyParameterPairs = zip(
        dependencyList.elements,
        this.hasFunctionFactory() ? this.getFactory().params : []
      );

      return dependencyParameterPairs
        .filter(([dependency]) => {
          return !this.t.isStringLiteral(dependency) || !keywords.includes(dependency.value);
        })
        .map(([dependency, paramName]) => {
          return createRequireExpression(this.t, dependency, paramName);
        });
    }

    return [];
  }

  // https://github.com/requirejs/requirejs/wiki/differences-between-the-simplified-commonjs-wrapper-and-standard-amd-define
  isSimplifiedCommonJSWrapper() {
    return !this.getDependencyList() && this.getFactoryArity() > 0;
  }

  // eslint-disable-next-line no-unused-vars
  processFunctionFactoryReplacement(factoryReplacement) {}

  getFunctionFactoryReplacement() {
    const factory = this.getFactory();
    const factoryArity = this.getFactoryArity();
    let replacementFuncExpr = this.t.functionExpression(
      null,
      [],
      this.t.blockStatement(this.getCommonJSRequireExpressions().concat(factory.body.body))
    );
    let replacementCallExprParams = [];

    if (this.isSimplifiedCommonJSWrapper()) {
      replacementFuncExpr = factory;
      replacementCallExprParams = keywords.slice(0, factoryArity).map(a => this.t.identifier(a));
    }

    return this.processFunctionFactoryReplacement(
      this.t.callExpression(replacementFuncExpr, replacementCallExprParams)
    );
  }

  getNonFunctionFactoryReplacement() {}

  getTransformationToCommonJS() {
    if (this.hasFunctionFactory()) {
      return this.getFunctionFactoryReplacement();
    } else if (this.getFactory()) {
      return this.getNonFunctionFactoryReplacement();
    } else {
      return this.getCommonJSRequireExpressions();
    }
  }
}

module.exports = AMDExpressionTransformer;
