import {
  FormData as FormData2,
  fetch_blob_default,
  formDataToBlob
} from "./chunk-UHMN67P6.mjs";
import {
  __commonJS,
  __name,
  __require,
  __toESM,
  init_esm
} from "./chunk-TQ3WNEB5.mjs";

// node_modules/.pnpm/@0no-co+graphql.web@1.0.4_graphql@16.8.1/node_modules/@0no-co/graphql.web/dist/graphql.web.js
var require_graphql_web = __commonJS({
  "node_modules/.pnpm/@0no-co+graphql.web@1.0.4_graphql@16.8.1/node_modules/@0no-co/graphql.web/dist/graphql.web.js"(exports) {
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    var GraphQLError = class extends Error {
      static {
        __name(this, "GraphQLError");
      }
      constructor(e2, r2, i2, n2, t2, a2, o2) {
        super(e2);
        this.name = "GraphQLError";
        this.message = e2;
        if (t2) {
          this.path = t2;
        }
        if (r2) {
          this.nodes = Array.isArray(r2) ? r2 : [r2];
        }
        if (i2) {
          this.source = i2;
        }
        if (n2) {
          this.positions = n2;
        }
        if (a2) {
          this.originalError = a2;
        }
        var l2 = o2;
        if (!l2 && a2) {
          var u2 = a2.extensions;
          if (u2 && "object" == typeof u2) {
            l2 = u2;
          }
        }
        this.extensions = l2 || {};
      }
      toJSON() {
        return {
          ...this,
          message: this.message
        };
      }
      toString() {
        return this.message;
      }
      get [Symbol.toStringTag]() {
        return "GraphQLError";
      }
    };
    var e;
    var r;
    function error(e2) {
      return new GraphQLError(`Syntax Error: Unexpected token at ${r} in ${e2}`);
    }
    __name(error, "error");
    function advance(i2) {
      i2.lastIndex = r;
      if (i2.test(e)) {
        return e.slice(r, r = i2.lastIndex);
      }
    }
    __name(advance, "advance");
    var i = / +(?=[^\s])/y;
    function blockString(e2) {
      var r2 = e2.split("\n");
      var n2 = "";
      var t2 = 0;
      var a2 = 0;
      var o2 = r2.length - 1;
      for (var l2 = 0; l2 < r2.length; l2++) {
        i.lastIndex = 0;
        if (i.test(r2[l2])) {
          if (l2 && (!t2 || i.lastIndex < t2)) {
            t2 = i.lastIndex;
          }
          a2 = a2 || l2;
          o2 = l2;
        }
      }
      for (var u2 = a2; u2 <= o2; u2++) {
        if (u2 !== a2) {
          n2 += "\n";
        }
        n2 += r2[u2].slice(t2).replace(/\\"""/g, '"""');
      }
      return n2;
    }
    __name(blockString, "blockString");
    function ignored() {
      for (var i2 = 0 | e.charCodeAt(r++); 9 === i2 || 10 === i2 || 13 === i2 || 32 === i2 || 35 === i2 || 44 === i2 || 65279 === i2; i2 = 0 | e.charCodeAt(r++)) {
        if (35 === i2) {
          while (10 !== (i2 = e.charCodeAt(r++)) && 13 !== i2) {
          }
        }
      }
      r--;
    }
    __name(ignored, "ignored");
    var n = /[_A-Za-z]\w*/y;
    function name() {
      var e2;
      if (e2 = advance(n)) {
        return {
          kind: "Name",
          value: e2
        };
      }
    }
    __name(name, "name");
    var t = /(?:null|true|false)/y;
    var a = /\$[_A-Za-z]\w*/y;
    var o = /-?\d+/y;
    var l = /(?:\.\d+)?[eE][+-]?\d+|\.\d+/y;
    var u = /\\/g;
    var v = /"""(?:"""|(?:[\s\S]*?[^\\])""")/y;
    var d = /"(?:"|[^\r\n]*?[^\\]")/y;
    function value(i2) {
      var s2;
      var c2;
      if (c2 = advance(t)) {
        s2 = "null" === c2 ? {
          kind: "NullValue"
        } : {
          kind: "BooleanValue",
          value: "true" === c2
        };
      } else if (!i2 && (c2 = advance(a))) {
        s2 = {
          kind: "Variable",
          name: {
            kind: "Name",
            value: c2.slice(1)
          }
        };
      } else if (c2 = advance(o)) {
        var f2 = c2;
        if (c2 = advance(l)) {
          s2 = {
            kind: "FloatValue",
            value: f2 + c2
          };
        } else {
          s2 = {
            kind: "IntValue",
            value: f2
          };
        }
      } else if (c2 = advance(n)) {
        s2 = {
          kind: "EnumValue",
          value: c2
        };
      } else if (c2 = advance(v)) {
        s2 = {
          kind: "StringValue",
          value: blockString(c2.slice(3, -3)),
          block: true
        };
      } else if (c2 = advance(d)) {
        s2 = {
          kind: "StringValue",
          value: u.test(c2) ? JSON.parse(c2) : c2.slice(1, -1),
          block: false
        };
      } else if (s2 = (/* @__PURE__ */ __name(function list(i3) {
        var n2;
        if (91 === e.charCodeAt(r)) {
          r++;
          ignored();
          var t2 = [];
          while (n2 = value(i3)) {
            t2.push(n2);
          }
          if (93 !== e.charCodeAt(r++)) {
            throw error("ListValue");
          }
          ignored();
          return {
            kind: "ListValue",
            values: t2
          };
        }
      }, "list"))(i2) || (/* @__PURE__ */ __name(function object(i3) {
        if (123 === e.charCodeAt(r)) {
          r++;
          ignored();
          var n2 = [];
          var t2;
          while (t2 = name()) {
            ignored();
            if (58 !== e.charCodeAt(r++)) {
              throw error("ObjectField");
            }
            ignored();
            var a2 = value(i3);
            if (!a2) {
              throw error("ObjectField");
            }
            n2.push({
              kind: "ObjectField",
              name: t2,
              value: a2
            });
          }
          if (125 !== e.charCodeAt(r++)) {
            throw error("ObjectValue");
          }
          ignored();
          return {
            kind: "ObjectValue",
            fields: n2
          };
        }
      }, "object"))(i2)) {
        return s2;
      }
      ignored();
      return s2;
    }
    __name(value, "value");
    function arguments_(i2) {
      var n2 = [];
      ignored();
      if (40 === e.charCodeAt(r)) {
        r++;
        ignored();
        var t2;
        while (t2 = name()) {
          ignored();
          if (58 !== e.charCodeAt(r++)) {
            throw error("Argument");
          }
          ignored();
          var a2 = value(i2);
          if (!a2) {
            throw error("Argument");
          }
          n2.push({
            kind: "Argument",
            name: t2,
            value: a2
          });
        }
        if (!n2.length || 41 !== e.charCodeAt(r++)) {
          throw error("Argument");
        }
        ignored();
      }
      return n2;
    }
    __name(arguments_, "arguments_");
    function directives(i2) {
      var n2 = [];
      ignored();
      while (64 === e.charCodeAt(r)) {
        r++;
        var t2 = name();
        if (!t2) {
          throw error("Directive");
        }
        ignored();
        n2.push({
          kind: "Directive",
          name: t2,
          arguments: arguments_(i2)
        });
      }
      return n2;
    }
    __name(directives, "directives");
    function field() {
      var i2 = name();
      if (i2) {
        ignored();
        var n2;
        if (58 === e.charCodeAt(r)) {
          r++;
          ignored();
          n2 = i2;
          if (!(i2 = name())) {
            throw error("Field");
          }
          ignored();
        }
        return {
          kind: "Field",
          alias: n2,
          name: i2,
          arguments: arguments_(false),
          directives: directives(false),
          selectionSet: selectionSet()
        };
      }
    }
    __name(field, "field");
    function type() {
      var i2;
      ignored();
      if (91 === e.charCodeAt(r)) {
        r++;
        ignored();
        var n2 = type();
        if (!n2 || 93 !== e.charCodeAt(r++)) {
          throw error("ListType");
        }
        i2 = {
          kind: "ListType",
          type: n2
        };
      } else if (i2 = name()) {
        i2 = {
          kind: "NamedType",
          name: i2
        };
      } else {
        throw error("NamedType");
      }
      ignored();
      if (33 === e.charCodeAt(r)) {
        r++;
        ignored();
        return {
          kind: "NonNullType",
          type: i2
        };
      } else {
        return i2;
      }
    }
    __name(type, "type");
    var s = /on/y;
    function typeCondition() {
      if (advance(s)) {
        ignored();
        var e2 = name();
        if (!e2) {
          throw error("NamedType");
        }
        ignored();
        return {
          kind: "NamedType",
          name: e2
        };
      }
    }
    __name(typeCondition, "typeCondition");
    var c = /\.\.\./y;
    function fragmentSpread() {
      if (advance(c)) {
        ignored();
        var e2 = r;
        var i2;
        if ((i2 = name()) && "on" !== i2.value) {
          return {
            kind: "FragmentSpread",
            name: i2,
            directives: directives(false)
          };
        } else {
          r = e2;
          var n2 = typeCondition();
          var t2 = directives(false);
          var a2 = selectionSet();
          if (!a2) {
            throw error("InlineFragment");
          }
          return {
            kind: "InlineFragment",
            typeCondition: n2,
            directives: t2,
            selectionSet: a2
          };
        }
      }
    }
    __name(fragmentSpread, "fragmentSpread");
    function selectionSet() {
      var i2;
      ignored();
      if (123 === e.charCodeAt(r)) {
        r++;
        ignored();
        var n2 = [];
        while (i2 = fragmentSpread() || field()) {
          n2.push(i2);
        }
        if (!n2.length || 125 !== e.charCodeAt(r++)) {
          throw error("SelectionSet");
        }
        ignored();
        return {
          kind: "SelectionSet",
          selections: n2
        };
      }
    }
    __name(selectionSet, "selectionSet");
    var f = /fragment/y;
    function fragmentDefinition() {
      if (advance(f)) {
        ignored();
        var e2 = name();
        if (!e2) {
          throw error("FragmentDefinition");
        }
        ignored();
        var r2 = typeCondition();
        if (!r2) {
          throw error("FragmentDefinition");
        }
        var i2 = directives(false);
        var n2 = selectionSet();
        if (!n2) {
          throw error("FragmentDefinition");
        }
        return {
          kind: "FragmentDefinition",
          name: e2,
          typeCondition: r2,
          directives: i2,
          selectionSet: n2
        };
      }
    }
    __name(fragmentDefinition, "fragmentDefinition");
    var p = /(?:query|mutation|subscription)/y;
    function operationDefinition() {
      var i2;
      var n2;
      var t2 = [];
      var o2 = [];
      if (i2 = advance(p)) {
        ignored();
        n2 = name();
        t2 = (/* @__PURE__ */ __name(function variableDefinitions() {
          var i3;
          var n3 = [];
          ignored();
          if (40 === e.charCodeAt(r)) {
            r++;
            ignored();
            while (i3 = advance(a)) {
              ignored();
              if (58 !== e.charCodeAt(r++)) {
                throw error("VariableDefinition");
              }
              var t3 = type();
              var o3 = void 0;
              if (61 === e.charCodeAt(r)) {
                r++;
                ignored();
                if (!(o3 = value(true))) {
                  throw error("VariableDefinition");
                }
              }
              ignored();
              n3.push({
                kind: "VariableDefinition",
                variable: {
                  kind: "Variable",
                  name: {
                    kind: "Name",
                    value: i3.slice(1)
                  }
                },
                type: t3,
                defaultValue: o3,
                directives: directives(true)
              });
            }
            if (41 !== e.charCodeAt(r++)) {
              throw error("VariableDefinition");
            }
            ignored();
          }
          return n3;
        }, "variableDefinitions"))();
        o2 = directives(false);
      }
      var l2 = selectionSet();
      if (l2) {
        return {
          kind: "OperationDefinition",
          operation: i2 || "query",
          name: n2,
          variableDefinitions: t2,
          directives: o2,
          selectionSet: l2
        };
      }
    }
    __name(operationDefinition, "operationDefinition");
    var m = {};
    function printString(e2) {
      return JSON.stringify(e2);
    }
    __name(printString, "printString");
    function printBlockString(e2) {
      return '"""\n' + e2.replace(/"""/g, '\\"""') + '\n"""';
    }
    __name(printBlockString, "printBlockString");
    var hasItems = /* @__PURE__ */ __name((e2) => !(!e2 || !e2.length), "hasItems");
    var g = {
      OperationDefinition(e2) {
        if ("query" === e2.operation && !e2.name && !hasItems(e2.variableDefinitions) && !hasItems(e2.directives)) {
          return g.SelectionSet(e2.selectionSet);
        }
        var r2 = e2.operation;
        if (e2.name) {
          r2 += " " + e2.name.value;
        }
        if (hasItems(e2.variableDefinitions)) {
          if (!e2.name) {
            r2 += " ";
          }
          r2 += "(" + e2.variableDefinitions.map(g.VariableDefinition).join(", ") + ")";
        }
        if (hasItems(e2.directives)) {
          r2 += " " + e2.directives.map(g.Directive).join(" ");
        }
        return r2 + " " + g.SelectionSet(e2.selectionSet);
      },
      VariableDefinition(e2) {
        var r2 = g.Variable(e2.variable) + ": " + print(e2.type);
        if (e2.defaultValue) {
          r2 += " = " + print(e2.defaultValue);
        }
        if (hasItems(e2.directives)) {
          r2 += " " + e2.directives.map(g.Directive).join(" ");
        }
        return r2;
      },
      Field(e2) {
        var r2 = (e2.alias ? e2.alias.value + ": " : "") + e2.name.value;
        if (hasItems(e2.arguments)) {
          var i2 = e2.arguments.map(g.Argument);
          var n2 = r2 + "(" + i2.join(", ") + ")";
          r2 = n2.length > 80 ? r2 + "(\n  " + i2.join("\n").replace(/\n/g, "\n  ") + "\n)" : n2;
        }
        if (hasItems(e2.directives)) {
          r2 += " " + e2.directives.map(g.Directive).join(" ");
        }
        return e2.selectionSet ? r2 + " " + g.SelectionSet(e2.selectionSet) : r2;
      },
      StringValue: /* @__PURE__ */ __name((e2) => e2.block ? printBlockString(e2.value) : printString(e2.value), "StringValue"),
      BooleanValue: /* @__PURE__ */ __name((e2) => "" + e2.value, "BooleanValue"),
      NullValue: /* @__PURE__ */ __name((e2) => "null", "NullValue"),
      IntValue: /* @__PURE__ */ __name((e2) => e2.value, "IntValue"),
      FloatValue: /* @__PURE__ */ __name((e2) => e2.value, "FloatValue"),
      EnumValue: /* @__PURE__ */ __name((e2) => e2.value, "EnumValue"),
      Name: /* @__PURE__ */ __name((e2) => e2.value, "Name"),
      Variable: /* @__PURE__ */ __name((e2) => "$" + e2.name.value, "Variable"),
      ListValue: /* @__PURE__ */ __name((e2) => "[" + e2.values.map(print).join(", ") + "]", "ListValue"),
      ObjectValue: /* @__PURE__ */ __name((e2) => "{" + e2.fields.map(g.ObjectField).join(", ") + "}", "ObjectValue"),
      ObjectField: /* @__PURE__ */ __name((e2) => e2.name.value + ": " + print(e2.value), "ObjectField"),
      Document: /* @__PURE__ */ __name((e2) => hasItems(e2.definitions) ? e2.definitions.map(print).join("\n\n") : "", "Document"),
      SelectionSet: /* @__PURE__ */ __name((e2) => "{\n  " + e2.selections.map(print).join("\n").replace(/\n/g, "\n  ") + "\n}", "SelectionSet"),
      Argument: /* @__PURE__ */ __name((e2) => e2.name.value + ": " + print(e2.value), "Argument"),
      FragmentSpread(e2) {
        var r2 = "..." + e2.name.value;
        if (hasItems(e2.directives)) {
          r2 += " " + e2.directives.map(g.Directive).join(" ");
        }
        return r2;
      },
      InlineFragment(e2) {
        var r2 = "...";
        if (e2.typeCondition) {
          r2 += " on " + e2.typeCondition.name.value;
        }
        if (hasItems(e2.directives)) {
          r2 += " " + e2.directives.map(g.Directive).join(" ");
        }
        return r2 + " " + print(e2.selectionSet);
      },
      FragmentDefinition(e2) {
        var r2 = "fragment " + e2.name.value;
        r2 += " on " + e2.typeCondition.name.value;
        if (hasItems(e2.directives)) {
          r2 += " " + e2.directives.map(g.Directive).join(" ");
        }
        return r2 + " " + print(e2.selectionSet);
      },
      Directive(e2) {
        var r2 = "@" + e2.name.value;
        if (hasItems(e2.arguments)) {
          r2 += "(" + e2.arguments.map(g.Argument).join(", ") + ")";
        }
        return r2;
      },
      NamedType: /* @__PURE__ */ __name((e2) => e2.name.value, "NamedType"),
      ListType: /* @__PURE__ */ __name((e2) => "[" + print(e2.type) + "]", "ListType"),
      NonNullType: /* @__PURE__ */ __name((e2) => print(e2.type) + "!", "NonNullType")
    };
    function print(e2) {
      return g[e2.kind] ? g[e2.kind](e2) : "";
    }
    __name(print, "print");
    function valueFromASTUntyped(e2, r2) {
      switch (e2.kind) {
        case "NullValue":
          return null;
        case "IntValue":
          return parseInt(e2.value, 10);
        case "FloatValue":
          return parseFloat(e2.value);
        case "StringValue":
        case "EnumValue":
        case "BooleanValue":
          return e2.value;
        case "ListValue":
          var i2 = [];
          for (var n2 = 0, t2 = e2.values; n2 < t2.length; n2 += 1) {
            i2.push(valueFromASTUntyped(t2[n2], r2));
          }
          return i2;
        case "ObjectValue":
          var a2 = /* @__PURE__ */ Object.create(null);
          for (var o2 = 0, l2 = e2.fields; o2 < l2.length; o2 += 1) {
            var u2 = l2[o2];
            a2[u2.name.value] = valueFromASTUntyped(u2.value, r2);
          }
          return a2;
        case "Variable":
          return r2 && r2[e2.name.value];
      }
    }
    __name(valueFromASTUntyped, "valueFromASTUntyped");
    exports.BREAK = m;
    exports.GraphQLError = GraphQLError;
    exports.Kind = {
      NAME: "Name",
      DOCUMENT: "Document",
      OPERATION_DEFINITION: "OperationDefinition",
      VARIABLE_DEFINITION: "VariableDefinition",
      SELECTION_SET: "SelectionSet",
      FIELD: "Field",
      ARGUMENT: "Argument",
      FRAGMENT_SPREAD: "FragmentSpread",
      INLINE_FRAGMENT: "InlineFragment",
      FRAGMENT_DEFINITION: "FragmentDefinition",
      VARIABLE: "Variable",
      INT: "IntValue",
      FLOAT: "FloatValue",
      STRING: "StringValue",
      BOOLEAN: "BooleanValue",
      NULL: "NullValue",
      ENUM: "EnumValue",
      LIST: "ListValue",
      OBJECT: "ObjectValue",
      OBJECT_FIELD: "ObjectField",
      DIRECTIVE: "Directive",
      NAMED_TYPE: "NamedType",
      LIST_TYPE: "ListType",
      NON_NULL_TYPE: "NonNullType"
    };
    exports.OperationTypeNode = {
      QUERY: "query",
      MUTATION: "mutation",
      SUBSCRIPTION: "subscription"
    };
    exports.parse = /* @__PURE__ */ __name(function parse(i2, n2) {
      e = "string" == typeof i2.body ? i2.body : i2;
      r = 0;
      return (/* @__PURE__ */ __name(function document2() {
        var e2;
        ignored();
        var r2 = [];
        while (e2 = fragmentDefinition() || operationDefinition()) {
          r2.push(e2);
        }
        return {
          kind: "Document",
          definitions: r2
        };
      }, "document"))();
    }, "parse");
    exports.parseType = /* @__PURE__ */ __name(function parseType(i2, n2) {
      e = "string" == typeof i2.body ? i2.body : i2;
      r = 0;
      return type();
    }, "parseType");
    exports.parseValue = /* @__PURE__ */ __name(function parseValue(i2, n2) {
      e = "string" == typeof i2.body ? i2.body : i2;
      r = 0;
      ignored();
      var t2 = value(false);
      if (!t2) {
        throw error("ValueNode");
      }
      return t2;
    }, "parseValue");
    exports.print = print;
    exports.printBlockString = printBlockString;
    exports.printString = printString;
    exports.valueFromASTUntyped = valueFromASTUntyped;
    exports.valueFromTypeNode = /* @__PURE__ */ __name(function valueFromTypeNode(e2, r2, i2) {
      if ("Variable" === e2.kind) {
        return i2 ? valueFromTypeNode(i2[e2.name.value], r2, i2) : void 0;
      } else if ("NonNullType" === r2.kind) {
        return "NullValue" !== e2.kind ? valueFromTypeNode(e2, r2, i2) : void 0;
      } else if ("NullValue" === e2.kind) {
        return null;
      } else if ("ListType" === r2.kind) {
        if ("ListValue" === e2.kind) {
          var n2 = [];
          for (var t2 = 0, a2 = e2.values; t2 < a2.length; t2 += 1) {
            var o2 = valueFromTypeNode(a2[t2], r2.type, i2);
            if (void 0 === o2) {
              return;
            } else {
              n2.push(o2);
            }
          }
          return n2;
        }
      } else if ("NamedType" === r2.kind) {
        switch (r2.name.value) {
          case "Int":
          case "Float":
          case "String":
          case "Bool":
            return r2.name.value + "Value" === e2.kind ? valueFromASTUntyped(e2, i2) : void 0;
          default:
            return valueFromASTUntyped(e2, i2);
        }
      }
    }, "valueFromTypeNode");
    exports.visit = /* @__PURE__ */ __name(function visit(e2, r2) {
      var i2 = [];
      var n2 = [];
      try {
        var t2 = (/* @__PURE__ */ __name(function traverse(e3, t3, a2) {
          var o2 = false;
          var l2 = r2[e3.kind] && r2[e3.kind].enter || r2[e3.kind] || r2.enter;
          var u2 = l2 && l2.call(r2, e3, t3, a2, n2, i2);
          if (false === u2) {
            return e3;
          } else if (null === u2) {
            return null;
          } else if (u2 === m) {
            throw m;
          } else if (u2 && "string" == typeof u2.kind) {
            o2 = u2 !== e3;
            e3 = u2;
          }
          if (a2) {
            i2.push(a2);
          }
          var v2;
          var d2 = {
            ...e3
          };
          for (var s2 in e3) {
            n2.push(s2);
            var c2 = e3[s2];
            if (Array.isArray(c2)) {
              var f2 = [];
              for (var p2 = 0; p2 < c2.length; p2++) {
                if (null != c2[p2] && "string" == typeof c2[p2].kind) {
                  i2.push(e3);
                  n2.push(p2);
                  v2 = traverse(c2[p2], p2, c2);
                  n2.pop();
                  i2.pop();
                  if (null == v2) {
                    o2 = true;
                  } else {
                    o2 = o2 || v2 !== c2[p2];
                    f2.push(v2);
                  }
                }
              }
              c2 = f2;
            } else if (null != c2 && "string" == typeof c2.kind) {
              if (void 0 !== (v2 = traverse(c2, s2, e3))) {
                o2 = o2 || c2 !== v2;
                c2 = v2;
              }
            }
            n2.pop();
            if (o2) {
              d2[s2] = c2;
            }
          }
          if (a2) {
            i2.pop();
          }
          var g2 = r2[e3.kind] && r2[e3.kind].leave || r2.leave;
          var h = g2 && g2.call(r2, e3, t3, a2, n2, i2);
          if (h === m) {
            throw m;
          } else if (void 0 !== h) {
            return h;
          } else if (void 0 !== u2) {
            return o2 ? d2 : u2;
          } else {
            return o2 ? d2 : e3;
          }
        }, "traverse"))(e2);
        return void 0 !== t2 && false !== t2 ? t2 : e2;
      } catch (r3) {
        if (r3 !== m) {
          throw r3;
        }
        return e2;
      }
    }, "visit");
  }
});

// node_modules/.pnpm/wonka@6.3.4/node_modules/wonka/dist/wonka.js
var require_wonka = __commonJS({
  "node_modules/.pnpm/wonka@6.3.4/node_modules/wonka/dist/wonka.js"(exports) {
    init_esm();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    var teardownPlaceholder = /* @__PURE__ */ __name(() => {
    }, "teardownPlaceholder");
    var e = teardownPlaceholder;
    function start(e2) {
      return {
        tag: 0,
        0: e2
      };
    }
    __name(start, "start");
    function push(e2) {
      return {
        tag: 1,
        0: e2
      };
    }
    __name(push, "push");
    var asyncIteratorSymbol = /* @__PURE__ */ __name(() => "function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator", "asyncIteratorSymbol");
    var observableSymbol = /* @__PURE__ */ __name(() => "function" == typeof Symbol && Symbol.observable || "@@observable", "observableSymbol");
    var identity = /* @__PURE__ */ __name((e2) => e2, "identity");
    function concatMap(r2) {
      return (t2) => (i) => {
        var s = [];
        var a = e;
        var f = e;
        var n = false;
        var l = false;
        var o = false;
        var u = false;
        function applyInnerSource(e2) {
          o = true;
          e2((e3) => {
            if (0 === e3) {
              if (o) {
                o = false;
                if (s.length) {
                  applyInnerSource(r2(s.shift()));
                } else if (u) {
                  i(0);
                } else if (!n) {
                  n = true;
                  a(0);
                }
              }
            } else if (0 === e3.tag) {
              l = false;
              (f = e3[0])(0);
            } else if (o) {
              i(e3);
              if (l) {
                l = false;
              } else {
                f(0);
              }
            }
          });
        }
        __name(applyInnerSource, "applyInnerSource");
        t2((e2) => {
          if (u) {
          } else if (0 === e2) {
            u = true;
            if (!o && !s.length) {
              i(0);
            }
          } else if (0 === e2.tag) {
            a = e2[0];
          } else {
            n = false;
            if (o) {
              s.push(e2[0]);
            } else {
              applyInnerSource(r2(e2[0]));
            }
          }
        });
        i(start((e2) => {
          if (1 === e2) {
            if (!u) {
              u = true;
              a(1);
            }
            if (o) {
              o = false;
              f(1);
            }
          } else {
            if (!u && !n) {
              n = true;
              a(0);
            }
            if (o && !l) {
              l = true;
              f(0);
            }
          }
        }));
      };
    }
    __name(concatMap, "concatMap");
    function concatAll(e2) {
      return concatMap(identity)(e2);
    }
    __name(concatAll, "concatAll");
    function mergeMap(r2) {
      return (t2) => (i) => {
        var s = [];
        var a = e;
        var f = false;
        var n = false;
        t2((t3) => {
          if (n) {
          } else if (0 === t3) {
            n = true;
            if (!s.length) {
              i(0);
            }
          } else if (0 === t3.tag) {
            a = t3[0];
          } else {
            f = false;
            !(/* @__PURE__ */ __name(function applyInnerSource(r3) {
              var t4 = e;
              r3((e2) => {
                if (0 === e2) {
                  if (s.length) {
                    var r4 = s.indexOf(t4);
                    if (r4 > -1) {
                      (s = s.slice()).splice(r4, 1);
                    }
                    if (!s.length) {
                      if (n) {
                        i(0);
                      } else if (!f) {
                        f = true;
                        a(0);
                      }
                    }
                  }
                } else if (0 === e2.tag) {
                  s.push(t4 = e2[0]);
                  t4(0);
                } else if (s.length) {
                  i(e2);
                  t4(0);
                }
              });
            }, "applyInnerSource"))(r2(t3[0]));
            if (!f) {
              f = true;
              a(0);
            }
          }
        });
        i(start((e2) => {
          if (1 === e2) {
            if (!n) {
              n = true;
              a(1);
            }
            for (var r3 = 0, t3 = s, i2 = s.length; r3 < i2; r3++) {
              t3[r3](1);
            }
            s.length = 0;
          } else {
            if (!n && !f) {
              f = true;
              a(0);
            } else {
              f = false;
            }
            for (var l = 0, o = s, u = s.length; l < u; l++) {
              o[l](0);
            }
          }
        }));
      };
    }
    __name(mergeMap, "mergeMap");
    function mergeAll(e2) {
      return mergeMap(identity)(e2);
    }
    __name(mergeAll, "mergeAll");
    function onPush(e2) {
      return (r2) => (t2) => {
        var i = false;
        r2((r3) => {
          if (i) {
          } else if (0 === r3) {
            i = true;
            t2(0);
          } else if (0 === r3.tag) {
            var s = r3[0];
            t2(start((e3) => {
              if (1 === e3) {
                i = true;
              }
              s(e3);
            }));
          } else {
            e2(r3[0]);
            t2(r3);
          }
        });
      };
    }
    __name(onPush, "onPush");
    function share(r2) {
      var t2 = [];
      var i = e;
      var s = false;
      return (e2) => {
        t2.push(e2);
        if (1 === t2.length) {
          r2((e3) => {
            if (0 === e3) {
              for (var r3 = 0, a = t2, f = t2.length; r3 < f; r3++) {
                a[r3](0);
              }
              t2.length = 0;
            } else if (0 === e3.tag) {
              i = e3[0];
            } else {
              s = false;
              for (var n = 0, l = t2, o = t2.length; n < o; n++) {
                l[n](e3);
              }
            }
          });
        }
        e2(start((r3) => {
          if (1 === r3) {
            var a = t2.indexOf(e2);
            if (a > -1) {
              (t2 = t2.slice()).splice(a, 1);
            }
            if (!t2.length) {
              i(1);
            }
          } else if (!s) {
            s = true;
            i(0);
          }
        }));
      };
    }
    __name(share, "share");
    function switchMap(r2) {
      return (t2) => (i) => {
        var s = e;
        var a = e;
        var f = false;
        var n = false;
        var l = false;
        var o = false;
        t2((t3) => {
          if (o) {
          } else if (0 === t3) {
            o = true;
            if (!l) {
              i(0);
            }
          } else if (0 === t3.tag) {
            s = t3[0];
          } else {
            if (l) {
              a(1);
              a = e;
            }
            if (!f) {
              f = true;
              s(0);
            } else {
              f = false;
            }
            !(/* @__PURE__ */ __name(function applyInnerSource(e2) {
              l = true;
              e2((e3) => {
                if (!l) {
                } else if (0 === e3) {
                  l = false;
                  if (o) {
                    i(0);
                  } else if (!f) {
                    f = true;
                    s(0);
                  }
                } else if (0 === e3.tag) {
                  n = false;
                  (a = e3[0])(0);
                } else {
                  i(e3);
                  if (!n) {
                    a(0);
                  } else {
                    n = false;
                  }
                }
              });
            }, "applyInnerSource"))(r2(t3[0]));
          }
        });
        i(start((e2) => {
          if (1 === e2) {
            if (!o) {
              o = true;
              s(1);
            }
            if (l) {
              l = false;
              a(1);
            }
          } else {
            if (!o && !f) {
              f = true;
              s(0);
            }
            if (l && !n) {
              n = true;
              a(0);
            }
          }
        }));
      };
    }
    __name(switchMap, "switchMap");
    function fromAsyncIterable(e2) {
      return (r2) => {
        var t2 = e2[asyncIteratorSymbol()] && e2[asyncIteratorSymbol()]() || e2;
        var i = false;
        var s = false;
        var a = false;
        var f;
        r2(start(async (e3) => {
          if (1 === e3) {
            i = true;
            if (t2.return) {
              t2.return();
            }
          } else if (s) {
            a = true;
          } else {
            for (a = s = true; a && !i; ) {
              if ((f = await t2.next()).done) {
                i = true;
                if (t2.return) {
                  await t2.return();
                }
                r2(0);
              } else {
                try {
                  a = false;
                  r2(push(f.value));
                } catch (e4) {
                  if (t2.throw) {
                    if (i = !!(await t2.throw(e4)).done) {
                      r2(0);
                    }
                  } else {
                    throw e4;
                  }
                }
              }
            }
            s = false;
          }
        }));
      };
    }
    __name(fromAsyncIterable, "fromAsyncIterable");
    function fromIterable(e2) {
      if (e2[Symbol.asyncIterator]) {
        return fromAsyncIterable(e2);
      }
      return (r2) => {
        var t2 = e2[Symbol.iterator]();
        var i = false;
        var s = false;
        var a = false;
        var f;
        r2(start((e3) => {
          if (1 === e3) {
            i = true;
            if (t2.return) {
              t2.return();
            }
          } else if (s) {
            a = true;
          } else {
            for (a = s = true; a && !i; ) {
              if ((f = t2.next()).done) {
                i = true;
                if (t2.return) {
                  t2.return();
                }
                r2(0);
              } else {
                try {
                  a = false;
                  r2(push(f.value));
                } catch (e4) {
                  if (t2.throw) {
                    if (i = !!t2.throw(e4).done) {
                      r2(0);
                    }
                  } else {
                    throw e4;
                  }
                }
              }
            }
            s = false;
          }
        }));
      };
    }
    __name(fromIterable, "fromIterable");
    var r = fromIterable;
    function make(e2) {
      return (r2) => {
        var t2 = false;
        var i = e2({
          next(e3) {
            if (!t2) {
              r2(push(e3));
            }
          },
          complete() {
            if (!t2) {
              t2 = true;
              r2(0);
            }
          }
        });
        r2(start((e3) => {
          if (1 === e3 && !t2) {
            t2 = true;
            i();
          }
        }));
      };
    }
    __name(make, "make");
    function subscribe(r2) {
      return (t2) => {
        var i = e;
        var s = false;
        t2((e2) => {
          if (0 === e2) {
            s = true;
          } else if (0 === e2.tag) {
            (i = e2[0])(0);
          } else if (!s) {
            r2(e2[0]);
            i(0);
          }
        });
        return {
          unsubscribe() {
            if (!s) {
              s = true;
              i(1);
            }
          }
        };
      };
    }
    __name(subscribe, "subscribe");
    var t = {
      done: true
    };
    function zip(r2) {
      var t2 = Object.keys(r2).length;
      return (i) => {
        var s = /* @__PURE__ */ new Set();
        var a = Array.isArray(r2) ? new Array(t2).fill(e) : {};
        var f = Array.isArray(r2) ? new Array(t2) : {};
        var n = false;
        var l = false;
        var o = false;
        var u = 0;
        var loop = /* @__PURE__ */ __name(function(v2) {
          r2[v2]((c) => {
            if (0 === c) {
              if (u >= t2 - 1) {
                o = true;
                i(0);
              } else {
                u++;
              }
            } else if (0 === c.tag) {
              a[v2] = c[0];
            } else if (!o) {
              f[v2] = c[0];
              s.add(v2);
              if (!n && s.size < t2) {
                if (!l) {
                  for (var p in r2) {
                    if (!s.has(p)) {
                      (a[p] || e)(0);
                    }
                  }
                } else {
                  l = false;
                }
              } else {
                n = true;
                l = false;
                i(push(Array.isArray(f) ? f.slice() : {
                  ...f
                }));
              }
            }
          });
        }, "loop");
        for (var v in r2) {
          loop(v);
        }
        i(start((e2) => {
          if (o) {
          } else if (1 === e2) {
            o = true;
            for (var r3 in a) {
              a[r3](1);
            }
          } else if (!l) {
            l = true;
            for (var t3 in a) {
              a[t3](0);
            }
          }
        }));
      };
    }
    __name(zip, "zip");
    exports.buffer = /* @__PURE__ */ __name(function buffer(r2) {
      return (t2) => (i) => {
        var s = [];
        var a = e;
        var f = e;
        var n = false;
        var l = false;
        t2((e2) => {
          if (l) {
          } else if (0 === e2) {
            l = true;
            f(1);
            if (s.length) {
              i(push(s));
            }
            i(0);
          } else if (0 === e2.tag) {
            a = e2[0];
            r2((e3) => {
              if (l) {
              } else if (0 === e3) {
                l = true;
                a(1);
                if (s.length) {
                  i(push(s));
                }
                i(0);
              } else if (0 === e3.tag) {
                f = e3[0];
              } else if (s.length) {
                var r3 = push(s);
                s = [];
                i(r3);
              }
            });
          } else {
            s.push(e2[0]);
            if (!n) {
              n = true;
              a(0);
              f(0);
            } else {
              n = false;
            }
          }
        });
        i(start((e2) => {
          if (1 === e2 && !l) {
            l = true;
            a(1);
            f(1);
          } else if (!l && !n) {
            n = true;
            a(0);
            f(0);
          }
        }));
      };
    }, "buffer");
    exports.combine = /* @__PURE__ */ __name(function combine(...e2) {
      return zip(e2);
    }, "combine");
    exports.concat = /* @__PURE__ */ __name(function concat(e2) {
      return concatAll(r(e2));
    }, "concat");
    exports.concatAll = concatAll;
    exports.concatMap = concatMap;
    exports.debounce = /* @__PURE__ */ __name(function debounce(e2) {
      return (r2) => (t2) => {
        var i;
        var s = false;
        var a = false;
        r2((r3) => {
          if (a) {
          } else if (0 === r3) {
            a = true;
            if (i) {
              s = true;
            } else {
              t2(0);
            }
          } else if (0 === r3.tag) {
            var f = r3[0];
            t2(start((e3) => {
              if (1 === e3 && !a) {
                a = true;
                s = false;
                if (i) {
                  clearTimeout(i);
                }
                f(1);
              } else if (!a) {
                f(0);
              }
            }));
          } else {
            if (i) {
              clearTimeout(i);
            }
            i = setTimeout(() => {
              i = void 0;
              t2(r3);
              if (s) {
                t2(0);
              }
            }, e2(r3[0]));
          }
        });
      };
    }, "debounce");
    exports.delay = /* @__PURE__ */ __name(function delay(e2) {
      return (r2) => (t2) => {
        var i = 0;
        r2((r3) => {
          if (0 !== r3 && 0 === r3.tag) {
            t2(r3);
          } else {
            i++;
            setTimeout(() => {
              if (i) {
                i--;
                t2(r3);
              }
            }, e2);
          }
        });
      };
    }, "delay");
    exports.empty = (e2) => {
      var r2 = false;
      e2(start((t2) => {
        if (1 === t2) {
          r2 = true;
        } else if (!r2) {
          r2 = true;
          e2(0);
        }
      }));
    };
    exports.filter = /* @__PURE__ */ __name(function filter(r2) {
      return (t2) => (i) => {
        var s = e;
        t2((e2) => {
          if (0 === e2) {
            i(0);
          } else if (0 === e2.tag) {
            s = e2[0];
            i(e2);
          } else if (!r2(e2[0])) {
            s(0);
          } else {
            i(e2);
          }
        });
      };
    }, "filter");
    exports.flatten = mergeAll;
    exports.forEach = /* @__PURE__ */ __name(function forEach(e2) {
      return (r2) => {
        subscribe(e2)(r2);
      };
    }, "forEach");
    exports.fromArray = r;
    exports.fromAsyncIterable = fromAsyncIterable;
    exports.fromCallbag = /* @__PURE__ */ __name(function fromCallbag(e2) {
      return (r2) => {
        e2(0, (e3, t2) => {
          if (0 === e3) {
            r2(start((e4) => {
              t2(e4 + 1);
            }));
          } else if (1 === e3) {
            r2(push(t2));
          } else {
            r2(0);
          }
        });
      };
    }, "fromCallbag");
    exports.fromDomEvent = /* @__PURE__ */ __name(function fromDomEvent(e2, r2) {
      return make((t2) => {
        e2.addEventListener(r2, t2.next);
        return () => e2.removeEventListener(r2, t2.next);
      });
    }, "fromDomEvent");
    exports.fromIterable = fromIterable;
    exports.fromObservable = /* @__PURE__ */ __name(function fromObservable(e2) {
      return (r2) => {
        var t2 = (e2[observableSymbol()] ? e2[observableSymbol()]() : e2).subscribe({
          next(e3) {
            r2(push(e3));
          },
          complete() {
            r2(0);
          },
          error(e3) {
            throw e3;
          }
        });
        r2(start((e3) => {
          if (1 === e3) {
            t2.unsubscribe();
          }
        }));
      };
    }, "fromObservable");
    exports.fromPromise = /* @__PURE__ */ __name(function fromPromise(e2) {
      return make((r2) => {
        e2.then((e3) => {
          Promise.resolve(e3).then(() => {
            r2.next(e3);
            r2.complete();
          });
        });
        return teardownPlaceholder;
      });
    }, "fromPromise");
    exports.fromValue = /* @__PURE__ */ __name(function fromValue(e2) {
      return (r2) => {
        var t2 = false;
        r2(start((i) => {
          if (1 === i) {
            t2 = true;
          } else if (!t2) {
            t2 = true;
            r2(push(e2));
            r2(0);
          }
        }));
      };
    }, "fromValue");
    exports.interval = /* @__PURE__ */ __name(function interval(e2) {
      return make((r2) => {
        var t2 = 0;
        var i = setInterval(() => r2.next(t2++), e2);
        return () => clearInterval(i);
      });
    }, "interval");
    exports.lazy = /* @__PURE__ */ __name(function lazy(e2) {
      return (r2) => e2()(r2);
    }, "lazy");
    exports.make = make;
    exports.makeSubject = /* @__PURE__ */ __name(function makeSubject() {
      var e2;
      var r2;
      return {
        source: share(make((t2) => {
          e2 = t2.next;
          r2 = t2.complete;
          return teardownPlaceholder;
        })),
        next(r3) {
          if (e2) {
            e2(r3);
          }
        },
        complete() {
          if (r2) {
            r2();
          }
        }
      };
    }, "makeSubject");
    exports.map = /* @__PURE__ */ __name(function map(e2) {
      return (r2) => (t2) => r2((r3) => {
        if (0 === r3 || 0 === r3.tag) {
          t2(r3);
        } else {
          t2(push(e2(r3[0])));
        }
      });
    }, "map");
    exports.merge = /* @__PURE__ */ __name(function merge(e2) {
      return mergeAll(r(e2));
    }, "merge");
    exports.mergeAll = mergeAll;
    exports.mergeMap = mergeMap;
    exports.never = (r2) => {
      r2(start(e));
    };
    exports.onEnd = /* @__PURE__ */ __name(function onEnd(e2) {
      return (r2) => (t2) => {
        var i = false;
        r2((r3) => {
          if (i) {
          } else if (0 === r3) {
            i = true;
            t2(0);
            e2();
          } else if (0 === r3.tag) {
            var s = r3[0];
            t2(start((r4) => {
              if (1 === r4) {
                i = true;
                s(1);
                e2();
              } else {
                s(r4);
              }
            }));
          } else {
            t2(r3);
          }
        });
      };
    }, "onEnd");
    exports.onPush = onPush;
    exports.onStart = /* @__PURE__ */ __name(function onStart(e2) {
      return (r2) => (t2) => r2((r3) => {
        if (0 === r3) {
          t2(0);
        } else if (0 === r3.tag) {
          t2(r3);
          e2();
        } else {
          t2(r3);
        }
      });
    }, "onStart");
    exports.pipe = (...e2) => {
      var r2 = e2[0];
      for (var t2 = 1, i = e2.length; t2 < i; t2++) {
        r2 = e2[t2](r2);
      }
      return r2;
    };
    exports.publish = /* @__PURE__ */ __name(function publish(e2) {
      subscribe((e3) => {
      })(e2);
    }, "publish");
    exports.sample = /* @__PURE__ */ __name(function sample(r2) {
      return (t2) => (i) => {
        var s = e;
        var a = e;
        var f;
        var n = false;
        var l = false;
        t2((e2) => {
          if (l) {
          } else if (0 === e2) {
            l = true;
            a(1);
            i(0);
          } else if (0 === e2.tag) {
            s = e2[0];
          } else {
            f = e2[0];
            if (!n) {
              n = true;
              a(0);
              s(0);
            } else {
              n = false;
            }
          }
        });
        r2((e2) => {
          if (l) {
          } else if (0 === e2) {
            l = true;
            s(1);
            i(0);
          } else if (0 === e2.tag) {
            a = e2[0];
          } else if (void 0 !== f) {
            var r3 = push(f);
            f = void 0;
            i(r3);
          }
        });
        i(start((e2) => {
          if (1 === e2 && !l) {
            l = true;
            s(1);
            a(1);
          } else if (!l && !n) {
            n = true;
            s(0);
            a(0);
          }
        }));
      };
    }, "sample");
    exports.scan = /* @__PURE__ */ __name(function scan(e2, r2) {
      return (t2) => (i) => {
        var s = r2;
        t2((r3) => {
          if (0 === r3) {
            i(0);
          } else if (0 === r3.tag) {
            i(r3);
          } else {
            i(push(s = e2(s, r3[0])));
          }
        });
      };
    }, "scan");
    exports.share = share;
    exports.skip = /* @__PURE__ */ __name(function skip(r2) {
      return (t2) => (i) => {
        var s = e;
        var a = r2;
        t2((e2) => {
          if (0 === e2) {
            i(0);
          } else if (0 === e2.tag) {
            s = e2[0];
            i(e2);
          } else if (a-- > 0) {
            s(0);
          } else {
            i(e2);
          }
        });
      };
    }, "skip");
    exports.skipUntil = /* @__PURE__ */ __name(function skipUntil(r2) {
      return (t2) => (i) => {
        var s = e;
        var a = e;
        var f = true;
        var n = false;
        var l = false;
        t2((e2) => {
          if (l) {
          } else if (0 === e2) {
            l = true;
            if (f) {
              a(1);
            }
            i(0);
          } else if (0 === e2.tag) {
            s = e2[0];
            r2((e3) => {
              if (0 === e3) {
                if (f) {
                  l = true;
                  s(1);
                }
              } else if (0 === e3.tag) {
                (a = e3[0])(0);
              } else {
                f = false;
                a(1);
              }
            });
          } else if (!f) {
            n = false;
            i(e2);
          } else if (!n) {
            n = true;
            s(0);
            a(0);
          } else {
            n = false;
          }
        });
        i(start((e2) => {
          if (1 === e2 && !l) {
            l = true;
            s(1);
            if (f) {
              a(1);
            }
          } else if (!l && !n) {
            n = true;
            if (f) {
              a(0);
            }
            s(0);
          }
        }));
      };
    }, "skipUntil");
    exports.skipWhile = /* @__PURE__ */ __name(function skipWhile(r2) {
      return (t2) => (i) => {
        var s = e;
        var a = true;
        t2((e2) => {
          if (0 === e2) {
            i(0);
          } else if (0 === e2.tag) {
            s = e2[0];
            i(e2);
          } else if (a) {
            if (r2(e2[0])) {
              s(0);
            } else {
              a = false;
              i(e2);
            }
          } else {
            i(e2);
          }
        });
      };
    }, "skipWhile");
    exports.subscribe = subscribe;
    exports.switchAll = /* @__PURE__ */ __name(function switchAll(e2) {
      return switchMap(identity)(e2);
    }, "switchAll");
    exports.switchMap = switchMap;
    exports.take = /* @__PURE__ */ __name(function take(r2) {
      return (t2) => (i) => {
        var s = e;
        var a = false;
        var f = 0;
        t2((e2) => {
          if (a) {
          } else if (0 === e2) {
            a = true;
            i(0);
          } else if (0 === e2.tag) {
            if (r2 <= 0) {
              a = true;
              i(0);
              e2[0](1);
            } else {
              s = e2[0];
            }
          } else if (f++ < r2) {
            i(e2);
            if (!a && f >= r2) {
              a = true;
              i(0);
              s(1);
            }
          } else {
            i(e2);
          }
        });
        i(start((e2) => {
          if (1 === e2 && !a) {
            a = true;
            s(1);
          } else if (0 === e2 && !a && f < r2) {
            s(0);
          }
        }));
      };
    }, "take");
    exports.takeLast = /* @__PURE__ */ __name(function takeLast(t2) {
      return (i) => (s) => {
        var a = [];
        var f = e;
        i((e2) => {
          if (0 === e2) {
            r(a)(s);
          } else if (0 === e2.tag) {
            if (t2 <= 0) {
              e2[0](1);
              r(a)(s);
            } else {
              (f = e2[0])(0);
            }
          } else {
            if (a.length >= t2 && t2) {
              a.shift();
            }
            a.push(e2[0]);
            f(0);
          }
        });
      };
    }, "takeLast");
    exports.takeUntil = /* @__PURE__ */ __name(function takeUntil(r2) {
      return (t2) => (i) => {
        var s = e;
        var a = e;
        var f = false;
        t2((e2) => {
          if (f) {
          } else if (0 === e2) {
            f = true;
            a(1);
            i(0);
          } else if (0 === e2.tag) {
            s = e2[0];
            r2((e3) => {
              if (0 === e3) {
              } else if (0 === e3.tag) {
                (a = e3[0])(0);
              } else {
                f = true;
                a(1);
                s(1);
                i(0);
              }
            });
          } else {
            i(e2);
          }
        });
        i(start((e2) => {
          if (1 === e2 && !f) {
            f = true;
            s(1);
            a(1);
          } else if (!f) {
            s(0);
          }
        }));
      };
    }, "takeUntil");
    exports.takeWhile = /* @__PURE__ */ __name(function takeWhile(r2, t2) {
      return (i) => (s) => {
        var a = e;
        var f = false;
        i((e2) => {
          if (f) {
          } else if (0 === e2) {
            f = true;
            s(0);
          } else if (0 === e2.tag) {
            a = e2[0];
            s(e2);
          } else if (!r2(e2[0])) {
            f = true;
            if (t2) {
              s(e2);
            }
            s(0);
            a(1);
          } else {
            s(e2);
          }
        });
      };
    }, "takeWhile");
    exports.tap = onPush;
    exports.throttle = /* @__PURE__ */ __name(function throttle(e2) {
      return (r2) => (t2) => {
        var i = false;
        var s;
        r2((r3) => {
          if (0 === r3) {
            if (s) {
              clearTimeout(s);
            }
            t2(0);
          } else if (0 === r3.tag) {
            var a = r3[0];
            t2(start((e3) => {
              if (1 === e3) {
                if (s) {
                  clearTimeout(s);
                }
                a(1);
              } else {
                a(0);
              }
            }));
          } else if (!i) {
            i = true;
            if (s) {
              clearTimeout(s);
            }
            s = setTimeout(() => {
              s = void 0;
              i = false;
            }, e2(r3[0]));
            t2(r3);
          }
        });
      };
    }, "throttle");
    exports.toArray = /* @__PURE__ */ __name(function toArray(r2) {
      var t2 = [];
      var i = e;
      var s = false;
      r2((e2) => {
        if (0 === e2) {
          s = true;
        } else if (0 === e2.tag) {
          (i = e2[0])(0);
        } else {
          t2.push(e2[0]);
          i(0);
        }
      });
      if (!s) {
        i(1);
      }
      return t2;
    }, "toArray");
    exports.toAsyncIterable = (r2) => {
      var i = [];
      var s = false;
      var a = false;
      var f = false;
      var n = e;
      var l;
      return {
        async next() {
          if (!a) {
            a = true;
            r2((e2) => {
              if (s) {
              } else if (0 === e2) {
                if (l) {
                  l = l(t);
                }
                s = true;
              } else if (0 === e2.tag) {
                f = true;
                (n = e2[0])(0);
              } else {
                f = false;
                if (l) {
                  l = l({
                    value: e2[0],
                    done: false
                  });
                } else {
                  i.push(e2[0]);
                }
              }
            });
          }
          if (s && !i.length) {
            return t;
          } else if (!s && !f && i.length <= 1) {
            f = true;
            n(0);
          }
          return i.length ? {
            value: i.shift(),
            done: false
          } : new Promise((e2) => l = e2);
        },
        async return() {
          if (!s) {
            l = n(1);
          }
          s = true;
          return t;
        },
        [asyncIteratorSymbol()]() {
          return this;
        }
      };
    };
    exports.toCallbag = /* @__PURE__ */ __name(function toCallbag(e2) {
      return (r2, t2) => {
        if (0 === r2) {
          e2((e3) => {
            if (0 === e3) {
              t2(2);
            } else if (0 === e3.tag) {
              t2(0, (r3) => {
                if (r3 < 3) {
                  e3[0](r3 - 1);
                }
              });
            } else {
              t2(1, e3[0]);
            }
          });
        }
      };
    }, "toCallbag");
    exports.toObservable = /* @__PURE__ */ __name(function toObservable(r2) {
      return {
        subscribe(t2, i, s) {
          var a = "object" == typeof t2 ? t2 : {
            next: t2,
            error: i,
            complete: s
          };
          var f = e;
          var n = false;
          r2((e2) => {
            if (n) {
            } else if (0 === e2) {
              n = true;
              if (a.complete) {
                a.complete();
              }
            } else if (0 === e2.tag) {
              (f = e2[0])(0);
            } else {
              a.next(e2[0]);
              f(0);
            }
          });
          var l = {
            closed: false,
            unsubscribe() {
              l.closed = true;
              n = true;
              f(1);
            }
          };
          return l;
        },
        [observableSymbol()]() {
          return this;
        }
      };
    }, "toObservable");
    exports.toPromise = /* @__PURE__ */ __name(function toPromise(r2) {
      return new Promise((t2) => {
        var i = e;
        var s;
        r2((e2) => {
          if (0 === e2) {
            Promise.resolve(s).then(t2);
          } else if (0 === e2.tag) {
            (i = e2[0])(0);
          } else {
            s = e2[0];
            i(0);
          }
        });
      });
    }, "toPromise");
    exports.zip = zip;
  }
});

// node_modules/.pnpm/@urql+core@4.1.3_graphql@16.8.1/node_modules/@urql/core/dist/urql-core-chunk.js
var require_urql_core_chunk = __commonJS({
  "node_modules/.pnpm/@urql+core@4.1.3_graphql@16.8.1/node_modules/@urql/core/dist/urql-core-chunk.js"(exports) {
    init_esm();
    var graphql_web = require_graphql_web();
    var wonka = require_wonka();
    var generateErrorMessage = /* @__PURE__ */ __name((networkErr, graphQlErrs) => {
      var error = "";
      if (networkErr) return `[Network] ${networkErr.message}`;
      if (graphQlErrs) {
        for (var err of graphQlErrs) {
          if (error) error += "\n";
          error += `[GraphQL] ${err.message}`;
        }
      }
      return error;
    }, "generateErrorMessage");
    var rehydrateGraphQlError = /* @__PURE__ */ __name((error) => {
      if (error && error.message && (error.extensions || error.name === "GraphQLError")) {
        return error;
      } else if (typeof error === "object" && error.message) {
        return new graphql_web.GraphQLError(error.message, error.nodes, error.source, error.positions, error.path, error, error.extensions || {});
      } else {
        return new graphql_web.GraphQLError(error);
      }
    }, "rehydrateGraphQlError");
    var CombinedError = class extends Error {
      static {
        __name(this, "CombinedError");
      }
      /** A list of GraphQL errors rehydrated from a {@link ExecutionResult}.
       *
       * @remarks
       * If an {@link ExecutionResult} received from the API contains a list of errors,
       * the `CombinedError` will rehydrate them, normalize them to
       * {@link GraphQLError | GraphQLErrors} and list them here.
       * An empty list indicates that no GraphQL error has been sent by the API.
       */
      /** Set to an error, if a GraphQL request has failed outright.
       *
       * @remarks
       * A GraphQL over HTTP request may fail and not reach the API. Any error that
       * prevents a GraphQl request outright, will be considered a “network error” and
       * set here.
       */
      /** Set to the {@link Response} object a fetch exchange received.
       *
       * @remarks
       * If a built-in fetch {@link Exchange} is used in `urql`, this may
       * be set to the {@link Response} object of the Fetch API response.
       * However, since `urql` doesn’t assume that all users will use HTTP
       * as the only or exclusive transport for GraphQL this property is
       * neither typed nor guaranteed and may be re-used for other purposes
       * by non-fetch exchanges.
       *
       * Hint: It can be useful to use `response.status` here, however, if
       * you plan on relying on this being a {@link Response} in your app,
       * which it is by default, then make sure you add some extra checks
       * before blindly assuming so!
       */
      constructor(input) {
        var normalizedGraphQLErrors = (input.graphQLErrors || []).map(rehydrateGraphQlError);
        var message = generateErrorMessage(input.networkError, normalizedGraphQLErrors);
        super(message);
        this.name = "CombinedError";
        this.message = message;
        this.graphQLErrors = normalizedGraphQLErrors;
        this.networkError = input.networkError;
        this.response = input.response;
      }
      toString() {
        return this.message;
      }
    };
    var phash = /* @__PURE__ */ __name((x, seed) => {
      var h = (seed || 5381) | 0;
      for (var i = 0, l = x.length | 0; i < l; i++) h = (h << 5) + h + x.charCodeAt(i);
      return h;
    }, "phash");
    var seen = /* @__PURE__ */ new Set();
    var cache = /* @__PURE__ */ new WeakMap();
    var stringify = /* @__PURE__ */ __name((x) => {
      if (x === null || seen.has(x)) {
        return "null";
      } else if (typeof x !== "object") {
        return JSON.stringify(x) || "";
      } else if (x.toJSON) {
        return stringify(x.toJSON());
      } else if (Array.isArray(x)) {
        var _out = "[";
        for (var value of x) {
          if (_out.length > 1) _out += ",";
          _out += stringify(value) || "null";
        }
        _out += "]";
        return _out;
      } else if (FileConstructor !== NoopConstructor && x instanceof FileConstructor || BlobConstructor !== NoopConstructor && x instanceof BlobConstructor) {
        return "null";
      }
      var keys = Object.keys(x).sort();
      if (!keys.length && x.constructor && x.constructor !== Object) {
        var key = cache.get(x) || Math.random().toString(36).slice(2);
        cache.set(x, key);
        return stringify({
          __key: key
        });
      }
      seen.add(x);
      var out = "{";
      for (var _key of keys) {
        var _value = stringify(x[_key]);
        if (_value) {
          if (out.length > 1) out += ",";
          out += stringify(_key) + ":" + _value;
        }
      }
      seen.delete(x);
      out += "}";
      return out;
    }, "stringify");
    var extract = /* @__PURE__ */ __name((map, path, x) => {
      if (x == null || typeof x !== "object" || x.toJSON || seen.has(x)) ;
      else if (Array.isArray(x)) {
        for (var i = 0, l = x.length; i < l; i++) extract(map, `${path}.${i}`, x[i]);
      } else if (x instanceof FileConstructor || x instanceof BlobConstructor) {
        map.set(path, x);
      } else {
        seen.add(x);
        for (var key of Object.keys(x)) extract(map, `${path}.${key}`, x[key]);
      }
    }, "extract");
    var stringifyVariables = /* @__PURE__ */ __name((x) => {
      seen.clear();
      return stringify(x);
    }, "stringifyVariables");
    var NoopConstructor = class {
      static {
        __name(this, "NoopConstructor");
      }
    };
    var FileConstructor = typeof File !== "undefined" ? File : NoopConstructor;
    var BlobConstructor = typeof Blob !== "undefined" ? Blob : NoopConstructor;
    var extractFiles = /* @__PURE__ */ __name((x) => {
      var map = /* @__PURE__ */ new Map();
      if (FileConstructor !== NoopConstructor || BlobConstructor !== NoopConstructor) {
        seen.clear();
        extract(map, "variables", x);
      }
      return map;
    }, "extractFiles");
    var SOURCE_NAME = "gql";
    var GRAPHQL_STRING_RE = /("{3}[\s\S]*"{3}|"(?:\\.|[^"])*")/g;
    var REPLACE_CHAR_RE = /(?:#[^\n\r]+)?(?:[\r\n]+|$)/g;
    var replaceOutsideStrings = /* @__PURE__ */ __name((str, idx) => idx % 2 === 0 ? str.replace(REPLACE_CHAR_RE, "\n") : str, "replaceOutsideStrings");
    var sanitizeDocument = /* @__PURE__ */ __name((node) => node.split(GRAPHQL_STRING_RE).map(replaceOutsideStrings).join("").trim(), "sanitizeDocument");
    var prints = /* @__PURE__ */ new Map();
    var docs = /* @__PURE__ */ new Map();
    var stringifyDocument = /* @__PURE__ */ __name((node) => {
      var printed;
      if (typeof node === "string") {
        printed = sanitizeDocument(node);
      } else if (node.loc && docs.get(node.__key) === node) {
        printed = node.loc.source.body;
      } else {
        printed = prints.get(node) || sanitizeDocument(graphql_web.print(node));
        prints.set(node, printed);
      }
      if (typeof node !== "string" && !node.loc) {
        node.loc = {
          start: 0,
          end: printed.length,
          source: {
            body: printed,
            name: SOURCE_NAME,
            locationOffset: {
              line: 1,
              column: 1
            }
          }
        };
      }
      return printed;
    }, "stringifyDocument");
    var hashDocument = /* @__PURE__ */ __name((node) => {
      var key = phash(stringifyDocument(node));
      if (node.definitions) {
        var operationName = getOperationName(node);
        if (operationName) key = phash(`
# ${operationName}`, key);
      }
      return key;
    }, "hashDocument");
    var keyDocument = /* @__PURE__ */ __name((node) => {
      var key;
      var query;
      if (typeof node === "string") {
        key = hashDocument(node);
        query = docs.get(key) || graphql_web.parse(node, {
          noLocation: true
        });
      } else {
        key = node.__key || hashDocument(node);
        query = docs.get(key) || node;
      }
      if (!query.loc) stringifyDocument(query);
      query.__key = key;
      docs.set(key, query);
      return query;
    }, "keyDocument");
    var createRequest = /* @__PURE__ */ __name((_query, _variables, extensions) => {
      var variables = _variables || {};
      var query = keyDocument(_query);
      var printedVars = stringifyVariables(variables);
      var key = query.__key;
      if (printedVars !== "{}") key = phash(printedVars, key);
      return {
        key,
        query,
        variables,
        extensions
      };
    }, "createRequest");
    var getOperationName = /* @__PURE__ */ __name((query) => {
      for (var node of query.definitions) {
        if (node.kind === graphql_web.Kind.OPERATION_DEFINITION) {
          return node.name ? node.name.value : void 0;
        }
      }
    }, "getOperationName");
    var getOperationType = /* @__PURE__ */ __name((query) => {
      for (var node of query.definitions) {
        if (node.kind === graphql_web.Kind.OPERATION_DEFINITION) {
          return node.operation;
        }
      }
    }, "getOperationType");
    var makeResult = /* @__PURE__ */ __name((operation, result, response) => {
      if (!("data" in result) && !("errors" in result)) {
        throw new Error("No Content");
      }
      var defaultHasNext = operation.kind === "subscription";
      return {
        operation,
        data: result.data,
        error: Array.isArray(result.errors) ? new CombinedError({
          graphQLErrors: result.errors,
          response
        }) : void 0,
        extensions: result.extensions ? {
          ...result.extensions
        } : void 0,
        hasNext: result.hasNext == null ? defaultHasNext : result.hasNext,
        stale: false
      };
    }, "makeResult");
    var deepMerge = /* @__PURE__ */ __name((target, source) => {
      if (typeof target === "object" && target != null) {
        if (!target.constructor || target.constructor === Object || Array.isArray(target)) {
          target = Array.isArray(target) ? [...target] : {
            ...target
          };
          for (var key of Object.keys(source)) target[key] = deepMerge(target[key], source[key]);
          return target;
        }
      }
      return source;
    }, "deepMerge");
    var mergeResultPatch = /* @__PURE__ */ __name((prevResult, nextResult, response) => {
      var errors = prevResult.error ? prevResult.error.graphQLErrors : [];
      var hasExtensions = !!prevResult.extensions || !!nextResult.extensions;
      var extensions = {
        ...prevResult.extensions,
        ...nextResult.extensions
      };
      var incremental = nextResult.incremental;
      if ("path" in nextResult) {
        incremental = [nextResult];
      }
      var withData = {
        data: prevResult.data
      };
      if (incremental) {
        for (var patch of incremental) {
          if (Array.isArray(patch.errors)) {
            errors.push(...patch.errors);
          }
          if (patch.extensions) {
            Object.assign(extensions, patch.extensions);
            hasExtensions = true;
          }
          var prop = "data";
          var part = withData;
          for (var i = 0, l = patch.path.length; i < l; prop = patch.path[i++]) {
            part = part[prop] = Array.isArray(part[prop]) ? [...part[prop]] : {
              ...part[prop]
            };
          }
          if (patch.items) {
            var startIndex = +prop >= 0 ? prop : 0;
            for (var _i = 0, _l = patch.items.length; _i < _l; _i++) part[startIndex + _i] = deepMerge(part[startIndex + _i], patch.items[_i]);
          } else if (patch.data !== void 0) {
            part[prop] = deepMerge(part[prop], patch.data);
          }
        }
      } else {
        withData.data = nextResult.data || prevResult.data;
        errors = nextResult.errors || errors;
      }
      return {
        operation: prevResult.operation,
        data: withData.data,
        error: errors.length ? new CombinedError({
          graphQLErrors: errors,
          response
        }) : void 0,
        extensions: hasExtensions ? extensions : void 0,
        hasNext: nextResult.hasNext != null ? nextResult.hasNext : prevResult.hasNext,
        stale: false
      };
    }, "mergeResultPatch");
    var makeErrorResult = /* @__PURE__ */ __name((operation, error, response) => ({
      operation,
      data: void 0,
      error: new CombinedError({
        networkError: error,
        response
      }),
      extensions: void 0,
      hasNext: false,
      stale: false
    }), "makeErrorResult");
    function makeFetchBody(request) {
      var isAPQ = request.extensions && request.extensions.persistedQuery && !request.extensions.persistedQuery.miss;
      return {
        query: isAPQ ? void 0 : stringifyDocument(request.query),
        operationName: getOperationName(request.query),
        variables: request.variables || void 0,
        extensions: request.extensions
      };
    }
    __name(makeFetchBody, "makeFetchBody");
    var makeFetchURL = /* @__PURE__ */ __name((operation, body) => {
      var useGETMethod = operation.kind === "query" && operation.context.preferGetMethod;
      if (!useGETMethod || !body) return operation.context.url;
      var url = new URL(operation.context.url);
      for (var key in body) {
        var value = body[key];
        if (value) {
          url.searchParams.set(key, typeof value === "object" ? stringifyVariables(value) : value);
        }
      }
      var finalUrl = url.toString();
      if (finalUrl.length > 2047 && useGETMethod !== "force") {
        operation.context.preferGetMethod = false;
        return operation.context.url;
      }
      return finalUrl;
    }, "makeFetchURL");
    var serializeBody = /* @__PURE__ */ __name((operation, body) => {
      var omitBody = operation.kind === "query" && !!operation.context.preferGetMethod;
      if (body && !omitBody) {
        var json = stringifyVariables(body);
        var files = extractFiles(body.variables);
        if (files.size) {
          var form = new FormData();
          form.append("operations", json);
          form.append("map", stringifyVariables({
            ...[...files.keys()].map((value) => [value])
          }));
          var index = 0;
          for (var file of files.values()) form.append(`${index++}`, file);
          return form;
        }
        return json;
      }
    }, "serializeBody");
    var makeFetchOptions = /* @__PURE__ */ __name((operation, body) => {
      var headers = {
        accept: operation.kind === "subscription" ? "text/event-stream, multipart/mixed" : "application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed"
      };
      var extraOptions = (typeof operation.context.fetchOptions === "function" ? operation.context.fetchOptions() : operation.context.fetchOptions) || {};
      if (extraOptions.headers) for (var key in extraOptions.headers) headers[key.toLowerCase()] = extraOptions.headers[key];
      var serializedBody = serializeBody(operation, body);
      if (typeof serializedBody === "string" && !headers["content-type"]) headers["content-type"] = "application/json";
      return {
        ...extraOptions,
        method: serializedBody ? "POST" : "GET",
        body: serializedBody,
        headers
      };
    }, "makeFetchOptions");
    var decoder = typeof TextDecoder !== "undefined" ? new TextDecoder() : null;
    var boundaryHeaderRe = /boundary="?([^=";]+)"?/i;
    var eventStreamRe = /data: ?([^\n]+)/;
    var toString = /* @__PURE__ */ __name((input) => input.constructor.name === "Buffer" ? input.toString() : decoder.decode(input), "toString");
    async function* streamBody(response) {
      if (response.body[Symbol.asyncIterator]) {
        for await (var chunk of response.body) yield toString(chunk);
      } else {
        var reader = response.body.getReader();
        var result;
        try {
          while (!(result = await reader.read()).done) yield toString(result.value);
        } finally {
          reader.cancel();
        }
      }
    }
    __name(streamBody, "streamBody");
    async function* split(chunks, boundary) {
      var buffer = "";
      var boundaryIndex;
      for await (var chunk of chunks) {
        buffer += chunk;
        while ((boundaryIndex = buffer.indexOf(boundary)) > -1) {
          yield buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + boundary.length);
        }
      }
    }
    __name(split, "split");
    async function* parseJSON(response) {
      yield JSON.parse(await response.text());
    }
    __name(parseJSON, "parseJSON");
    async function* parseEventStream(response) {
      var payload;
      for await (var chunk of split(streamBody(response), "\n\n")) {
        var match = chunk.match(eventStreamRe);
        if (match) {
          var _chunk = match[1];
          try {
            yield payload = JSON.parse(_chunk);
          } catch (error) {
            if (!payload) throw error;
          }
          if (payload && payload.hasNext === false) break;
        }
      }
      if (payload && payload.hasNext !== false) {
        yield {
          hasNext: false
        };
      }
    }
    __name(parseEventStream, "parseEventStream");
    async function* parseMultipartMixed(contentType, response) {
      var boundaryHeader = contentType.match(boundaryHeaderRe);
      var boundary = "--" + (boundaryHeader ? boundaryHeader[1] : "-");
      var isPreamble = true;
      var payload;
      for await (var chunk of split(streamBody(response), "\r\n" + boundary)) {
        if (isPreamble) {
          isPreamble = false;
          var preambleIndex = chunk.indexOf(boundary);
          if (preambleIndex > -1) {
            chunk = chunk.slice(preambleIndex + boundary.length);
          } else {
            continue;
          }
        }
        try {
          yield payload = JSON.parse(chunk.slice(chunk.indexOf("\r\n\r\n") + 4));
        } catch (error) {
          if (!payload) throw error;
        }
        if (payload && payload.hasNext === false) break;
      }
      if (payload && payload.hasNext !== false) {
        yield {
          hasNext: false
        };
      }
    }
    __name(parseMultipartMixed, "parseMultipartMixed");
    async function* fetchOperation(operation, url, fetchOptions) {
      var networkMode = true;
      var result = null;
      var response;
      try {
        yield await Promise.resolve();
        response = await (operation.context.fetch || fetch)(url, fetchOptions);
        var contentType = response.headers.get("Content-Type") || "";
        var results;
        if (/multipart\/mixed/i.test(contentType)) {
          results = parseMultipartMixed(contentType, response);
        } else if (/text\/event-stream/i.test(contentType)) {
          results = parseEventStream(response);
        } else if (!/text\//i.test(contentType)) {
          results = parseJSON(response);
        } else {
          throw new Error(await response.text());
        }
        for await (var payload of results) {
          result = result ? mergeResultPatch(result, payload, response) : makeResult(operation, payload, response);
          networkMode = false;
          yield result;
          networkMode = true;
        }
        if (!result) {
          yield result = makeResult(operation, {}, response);
        }
      } catch (error) {
        if (!networkMode) {
          throw error;
        }
        yield makeErrorResult(operation, response && (response.status < 200 || response.status >= 300) && response.statusText ? new Error(response.statusText) : error, response);
      }
    }
    __name(fetchOperation, "fetchOperation");
    function makeFetchSource(operation, url, fetchOptions) {
      var abortController;
      if (typeof AbortController !== "undefined") {
        fetchOptions.signal = (abortController = new AbortController()).signal;
      }
      return wonka.onEnd(() => {
        if (abortController) abortController.abort();
      })(wonka.filter((result) => !!result)(wonka.fromAsyncIterable(fetchOperation(operation, url, fetchOptions))));
    }
    __name(makeFetchSource, "makeFetchSource");
    exports.CombinedError = CombinedError;
    exports.createRequest = createRequest;
    exports.getOperationType = getOperationType;
    exports.keyDocument = keyDocument;
    exports.makeErrorResult = makeErrorResult;
    exports.makeFetchBody = makeFetchBody;
    exports.makeFetchOptions = makeFetchOptions;
    exports.makeFetchSource = makeFetchSource;
    exports.makeFetchURL = makeFetchURL;
    exports.makeResult = makeResult;
    exports.mergeResultPatch = mergeResultPatch;
    exports.stringifyDocument = stringifyDocument;
    exports.stringifyVariables = stringifyVariables;
  }
});

// node_modules/.pnpm/@urql+core@4.1.3_graphql@16.8.1/node_modules/@urql/core/dist/urql-core.js
var require_urql_core = __commonJS({
  "node_modules/.pnpm/@urql+core@4.1.3_graphql@16.8.1/node_modules/@urql/core/dist/urql-core.js"(exports) {
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var graphql_web = require_graphql_web();
    var fetchSource = require_urql_core_chunk();
    var wonka = require_wonka();
    var collectTypes = /* @__PURE__ */ __name((obj, types3) => {
      if (Array.isArray(obj)) {
        for (var item of obj) collectTypes(item, types3);
      } else if (typeof obj === "object" && obj !== null) {
        for (var _key in obj) {
          if (_key === "__typename" && typeof obj[_key] === "string") {
            types3.add(obj[_key]);
          } else {
            collectTypes(obj[_key], types3);
          }
        }
      }
      return types3;
    }, "collectTypes");
    var collectTypenames = /* @__PURE__ */ __name((response) => [...collectTypes(response, /* @__PURE__ */ new Set())], "collectTypenames");
    var formatNode = /* @__PURE__ */ __name((node) => {
      if ("definitions" in node) {
        var definitions = [];
        for (var definition of node.definitions) {
          var newDefinition = formatNode(definition);
          definitions.push(newDefinition);
        }
        return {
          ...node,
          definitions
        };
      }
      if ("directives" in node && node.directives && node.directives.length) {
        var directives = [];
        var _directives = {};
        for (var directive of node.directives) {
          var name = directive.name.value;
          if (name[0] !== "_") {
            directives.push(directive);
          } else {
            name = name.slice(1);
          }
          _directives[name] = directive;
        }
        node = {
          ...node,
          directives,
          _directives
        };
      }
      if ("selectionSet" in node) {
        var selections = [];
        var hasTypename = node.kind === graphql_web.Kind.OPERATION_DEFINITION;
        if (node.selectionSet) {
          for (var selection of node.selectionSet.selections || []) {
            hasTypename = hasTypename || selection.kind === graphql_web.Kind.FIELD && selection.name.value === "__typename" && !selection.alias;
            var newSelection = formatNode(selection);
            selections.push(newSelection);
          }
          if (!hasTypename) {
            selections.push({
              kind: graphql_web.Kind.FIELD,
              name: {
                kind: graphql_web.Kind.NAME,
                value: "__typename"
              },
              _generated: true
            });
          }
          return {
            ...node,
            selectionSet: {
              ...node.selectionSet,
              selections
            }
          };
        }
      }
      return node;
    }, "formatNode");
    var formattedDocs = /* @__PURE__ */ new Map();
    var formatDocument = /* @__PURE__ */ __name((node) => {
      var query = fetchSource.keyDocument(node);
      var result = formattedDocs.get(query.__key);
      if (!result) {
        formattedDocs.set(query.__key, result = formatNode(query));
        Object.defineProperty(result, "__key", {
          value: query.__key,
          enumerable: false
        });
      }
      return result;
    }, "formatDocument");
    var maskTypename = /* @__PURE__ */ __name((data, isRoot) => {
      if (!data || typeof data !== "object") {
        return data;
      } else if (Array.isArray(data)) {
        return data.map((d) => maskTypename(d));
      } else if (data && typeof data === "object" && (isRoot || "__typename" in data)) {
        var acc = {};
        for (var key in data) {
          if (key === "__typename") {
            Object.defineProperty(acc, "__typename", {
              enumerable: false,
              value: data.__typename
            });
          } else {
            acc[key] = maskTypename(data[key]);
          }
        }
        return acc;
      } else {
        return data;
      }
    }, "maskTypename");
    function withPromise(_source$) {
      var source$ = /* @__PURE__ */ __name((sink) => _source$(sink), "source$");
      source$.toPromise = () => wonka.toPromise(wonka.take(1)(wonka.filter((result) => !result.stale && !result.hasNext)(source$)));
      source$.then = (onResolve, onReject) => source$.toPromise().then(onResolve, onReject);
      source$.subscribe = (onResult) => wonka.subscribe(onResult)(source$);
      return source$;
    }
    __name(withPromise, "withPromise");
    function makeOperation(kind, request, context) {
      return {
        ...request,
        kind,
        context: request.context ? {
          ...request.context,
          ...context
        } : context || request.context
      };
    }
    __name(makeOperation, "makeOperation");
    var addMetadata = /* @__PURE__ */ __name((operation, meta) => {
      return makeOperation(operation.kind, operation, {
        meta: {
          ...operation.context.meta,
          ...meta
        }
      });
    }, "addMetadata");
    var noop = /* @__PURE__ */ __name(() => {
    }, "noop");
    function gql(parts) {
      var fragmentNames = /* @__PURE__ */ new Map();
      var definitions = [];
      var source = [];
      var body = Array.isArray(parts) ? parts[0] : parts || "";
      for (var i = 1; i < arguments.length; i++) {
        var value = arguments[i];
        if (value && value.definitions) {
          source.push(value);
        } else {
          body += value;
        }
        body += arguments[0][i];
      }
      source.unshift(fetchSource.keyDocument(body));
      for (var document2 of source) {
        for (var definition of document2.definitions) {
          if (definition.kind === graphql_web.Kind.FRAGMENT_DEFINITION) {
            var name = definition.name.value;
            var _value = fetchSource.stringifyDocument(definition);
            if (!fragmentNames.has(name)) {
              fragmentNames.set(name, _value);
              definitions.push(definition);
            } else if (process.env.NODE_ENV !== "production" && fragmentNames.get(name) !== _value) {
              console.warn("[WARNING: Duplicate Fragment] A fragment with name `" + name + "` already exists in this document.\nWhile fragment names may not be unique across your source, each name must be unique per document.");
            }
          } else {
            definitions.push(definition);
          }
        }
      }
      return fetchSource.keyDocument({
        kind: graphql_web.Kind.DOCUMENT,
        definitions
      });
    }
    __name(gql, "gql");
    var shouldSkip = /* @__PURE__ */ __name(({
      kind
    }) => kind !== "mutation" && kind !== "query", "shouldSkip");
    var mapTypeNames = /* @__PURE__ */ __name((operation) => {
      var query = formatDocument(operation.query);
      if (query !== operation.query) {
        var formattedOperation = makeOperation(operation.kind, operation);
        formattedOperation.query = query;
        return formattedOperation;
      } else {
        return operation;
      }
    }, "mapTypeNames");
    var cacheExchange2 = /* @__PURE__ */ __name(({
      forward,
      client,
      dispatchDebug
    }) => {
      var resultCache = /* @__PURE__ */ new Map();
      var operationCache = /* @__PURE__ */ new Map();
      var isOperationCached = /* @__PURE__ */ __name((operation) => operation.kind === "query" && operation.context.requestPolicy !== "network-only" && (operation.context.requestPolicy === "cache-only" || resultCache.has(operation.key)), "isOperationCached");
      return (ops$) => {
        var cachedOps$ = wonka.map((operation) => {
          var cachedResult = resultCache.get(operation.key);
          process.env.NODE_ENV !== "production" ? dispatchDebug({
            operation,
            ...cachedResult ? {
              type: "cacheHit",
              message: "The result was successfully retried from the cache"
            } : {
              type: "cacheMiss",
              message: "The result could not be retrieved from the cache"
            },
            "source": "cacheExchange"
          }) : void 0;
          var result = cachedResult;
          if (process.env.NODE_ENV !== "production") {
            result = {
              ...result,
              operation: process.env.NODE_ENV !== "production" ? addMetadata(operation, {
                cacheOutcome: cachedResult ? "hit" : "miss"
              }) : operation
            };
          }
          if (operation.context.requestPolicy === "cache-and-network") {
            result.stale = true;
            reexecuteOperation(client, operation);
          }
          return result;
        })(wonka.filter((op) => !shouldSkip(op) && isOperationCached(op))(ops$));
        var forwardedOps$ = wonka.tap((response) => {
          var {
            operation
          } = response;
          if (!operation) return;
          var typenames = operation.context.additionalTypenames || [];
          if (response.operation.kind !== "subscription") {
            typenames = collectTypenames(response.data).concat(typenames);
          }
          if (response.operation.kind === "mutation" || response.operation.kind === "subscription") {
            var pendingOperations = /* @__PURE__ */ new Set();
            process.env.NODE_ENV !== "production" ? dispatchDebug({
              type: "cacheInvalidation",
              message: `The following typenames have been invalidated: ${typenames}`,
              operation,
              data: {
                typenames,
                response
              },
              "source": "cacheExchange"
            }) : void 0;
            for (var i = 0; i < typenames.length; i++) {
              var typeName = typenames[i];
              var operations = operationCache.get(typeName);
              if (!operations) operationCache.set(typeName, operations = /* @__PURE__ */ new Set());
              for (var key of operations.values()) pendingOperations.add(key);
              operations.clear();
            }
            for (var _key of pendingOperations.values()) {
              if (resultCache.has(_key)) {
                operation = resultCache.get(_key).operation;
                resultCache.delete(_key);
                reexecuteOperation(client, operation);
              }
            }
          } else if (operation.kind === "query" && response.data) {
            resultCache.set(operation.key, response);
            for (var _i = 0; _i < typenames.length; _i++) {
              var _typeName = typenames[_i];
              var _operations = operationCache.get(_typeName);
              if (!_operations) operationCache.set(_typeName, _operations = /* @__PURE__ */ new Set());
              _operations.add(operation.key);
            }
          }
        })(forward(wonka.filter((op) => op.kind !== "query" || op.context.requestPolicy !== "cache-only")(wonka.map((op) => process.env.NODE_ENV !== "production" ? addMetadata(op, {
          cacheOutcome: "miss"
        }) : op)(wonka.merge([wonka.map(mapTypeNames)(wonka.filter((op) => !shouldSkip(op) && !isOperationCached(op))(ops$)), wonka.filter((op) => shouldSkip(op))(ops$)])))));
        return wonka.merge([cachedOps$, forwardedOps$]);
      };
    }, "cacheExchange");
    var reexecuteOperation = /* @__PURE__ */ __name((client, operation) => {
      return client.reexecuteOperation(makeOperation(operation.kind, operation, {
        requestPolicy: "network-only"
      }));
    }, "reexecuteOperation");
    var serializeResult = /* @__PURE__ */ __name((result, includeExtensions) => {
      var serialized = {
        data: JSON.stringify(result.data),
        hasNext: result.hasNext
      };
      if (result.data !== void 0) {
        serialized.data = JSON.stringify(result.data);
      }
      if (includeExtensions && result.extensions !== void 0) {
        serialized.extensions = JSON.stringify(result.extensions);
      }
      if (result.error) {
        serialized.error = {
          graphQLErrors: result.error.graphQLErrors.map((error) => {
            if (!error.path && !error.extensions) return error.message;
            return {
              message: error.message,
              path: error.path,
              extensions: error.extensions
            };
          })
        };
        if (result.error.networkError) {
          serialized.error.networkError = "" + result.error.networkError;
        }
      }
      return serialized;
    }, "serializeResult");
    var deserializeResult = /* @__PURE__ */ __name((operation, result, includeExtensions) => ({
      operation,
      data: result.data ? JSON.parse(result.data) : void 0,
      extensions: includeExtensions && result.extensions ? JSON.parse(result.extensions) : void 0,
      error: result.error ? new fetchSource.CombinedError({
        networkError: result.error.networkError ? new Error(result.error.networkError) : void 0,
        graphQLErrors: result.error.graphQLErrors
      }) : void 0,
      stale: false,
      hasNext: !!result.hasNext
    }), "deserializeResult");
    var revalidated = /* @__PURE__ */ new Set();
    var ssrExchange = /* @__PURE__ */ __name((params = {}) => {
      var staleWhileRevalidate = !!params.staleWhileRevalidate;
      var includeExtensions = !!params.includeExtensions;
      var data = {};
      var invalidateQueue = [];
      var invalidate = /* @__PURE__ */ __name((result) => {
        invalidateQueue.push(result.operation.key);
        if (invalidateQueue.length === 1) {
          Promise.resolve().then(() => {
            var key;
            while (key = invalidateQueue.shift()) {
              data[key] = null;
            }
          });
        }
      }, "invalidate");
      var ssr = /* @__PURE__ */ __name(({
        client,
        forward
      }) => (ops$) => {
        var isClient = params && typeof params.isClient === "boolean" ? !!params.isClient : !client.suspense;
        var forwardedOps$ = forward(wonka.map(mapTypeNames)(wonka.filter((operation) => operation.kind === "teardown" || !data[operation.key] || !!data[operation.key].hasNext || operation.context.requestPolicy === "network-only")(ops$)));
        var cachedOps$ = wonka.map((op) => {
          var serialized = data[op.key];
          var cachedResult = deserializeResult(op, serialized, includeExtensions);
          if (staleWhileRevalidate && !revalidated.has(op.key)) {
            cachedResult.stale = true;
            revalidated.add(op.key);
            reexecuteOperation(client, op);
          }
          var result = {
            ...cachedResult,
            operation: process.env.NODE_ENV !== "production" ? addMetadata(op, {
              cacheOutcome: "hit"
            }) : op
          };
          return result;
        })(wonka.filter((operation) => operation.kind !== "teardown" && !!data[operation.key] && operation.context.requestPolicy !== "network-only")(ops$));
        if (!isClient) {
          forwardedOps$ = wonka.tap((result) => {
            var {
              operation
            } = result;
            if (operation.kind !== "mutation") {
              var serialized = serializeResult(result, includeExtensions);
              data[operation.key] = serialized;
            }
          })(forwardedOps$);
        } else {
          cachedOps$ = wonka.tap(invalidate)(cachedOps$);
        }
        return wonka.merge([forwardedOps$, cachedOps$]);
      }, "ssr");
      ssr.restoreData = (restore) => {
        for (var _key in restore) {
          if (data[_key] !== null) {
            data[_key] = restore[_key];
          }
        }
      };
      ssr.extractData = () => {
        var result = {};
        for (var _key2 in data) if (data[_key2] != null) result[_key2] = data[_key2];
        return result;
      };
      if (params && params.initialState) {
        ssr.restoreData(params.initialState);
      }
      return ssr;
    }, "ssrExchange");
    var subscriptionExchange = /* @__PURE__ */ __name(({
      forwardSubscription,
      enableAllOperations,
      isSubscriptionOperation
    }) => ({
      client,
      forward
    }) => {
      var createSubscriptionSource = /* @__PURE__ */ __name((operation) => {
        var observableish = forwardSubscription(fetchSource.makeFetchBody(operation), operation);
        return wonka.make((observer) => {
          var isComplete = false;
          var sub;
          var result;
          function nextResult(value) {
            observer.next(result = result ? fetchSource.mergeResultPatch(result, value) : fetchSource.makeResult(operation, value));
          }
          __name(nextResult, "nextResult");
          Promise.resolve().then(() => {
            if (isComplete) return;
            sub = observableish.subscribe({
              next: nextResult,
              error(error) {
                if (Array.isArray(error)) {
                  nextResult({
                    errors: error
                  });
                } else {
                  observer.next(fetchSource.makeErrorResult(operation, error));
                }
                observer.complete();
              },
              complete() {
                if (!isComplete) {
                  isComplete = true;
                  if (operation.kind === "subscription") {
                    client.reexecuteOperation(makeOperation("teardown", operation, operation.context));
                  }
                  if (result && result.hasNext) {
                    nextResult({
                      hasNext: false
                    });
                  }
                  observer.complete();
                }
              }
            });
          });
          return () => {
            isComplete = true;
            if (sub) sub.unsubscribe();
          };
        });
      }, "createSubscriptionSource");
      var isSubscriptionOperationFn = isSubscriptionOperation || ((operation) => operation.kind === "subscription" || !!enableAllOperations && (operation.kind === "query" || operation.kind === "mutation"));
      return (ops$) => {
        var subscriptionResults$ = wonka.mergeMap((operation) => {
          var {
            key
          } = operation;
          var teardown$ = wonka.filter((op) => op.kind === "teardown" && op.key === key)(ops$);
          return wonka.takeUntil(teardown$)(createSubscriptionSource(operation));
        })(wonka.filter((operation) => operation.kind !== "teardown" && isSubscriptionOperationFn(operation))(ops$));
        var forward$ = forward(wonka.filter((operation) => operation.kind === "teardown" || !isSubscriptionOperationFn(operation))(ops$));
        return wonka.merge([subscriptionResults$, forward$]);
      };
    }, "subscriptionExchange");
    var debugExchange = /* @__PURE__ */ __name(({
      forward
    }) => {
      if (process.env.NODE_ENV === "production") {
        return (ops$) => forward(ops$);
      } else {
        return (ops$) => wonka.tap((result) => (
          // eslint-disable-next-line no-console
          console.log("[Exchange debug]: Completed operation: ", result)
        ))(forward(
          // eslint-disable-next-line no-console
          wonka.tap((op) => console.log("[Exchange debug]: Incoming operation: ", op))(ops$)
        ));
      }
    }, "debugExchange");
    var dedupExchange = /* @__PURE__ */ __name(({
      forward
    }) => (ops$) => forward(ops$), "dedupExchange");
    var fetchExchange2 = /* @__PURE__ */ __name(({
      forward,
      dispatchDebug
    }) => {
      return (ops$) => {
        var fetchResults$ = wonka.mergeMap((operation) => {
          var body = fetchSource.makeFetchBody(operation);
          var url = fetchSource.makeFetchURL(operation, body);
          var fetchOptions = fetchSource.makeFetchOptions(operation, body);
          process.env.NODE_ENV !== "production" ? dispatchDebug({
            type: "fetchRequest",
            message: "A fetch request is being executed.",
            operation,
            data: {
              url,
              fetchOptions
            },
            "source": "fetchExchange"
          }) : void 0;
          var source = wonka.takeUntil(wonka.filter((op) => op.kind === "teardown" && op.key === operation.key)(ops$))(fetchSource.makeFetchSource(operation, url, fetchOptions));
          if (process.env.NODE_ENV !== "production") {
            return wonka.onPush((result) => {
              var error = !result.data ? result.error : void 0;
              process.env.NODE_ENV !== "production" ? dispatchDebug({
                type: error ? "fetchError" : "fetchSuccess",
                message: `A ${error ? "failed" : "successful"} fetch response has been returned.`,
                operation,
                data: {
                  url,
                  fetchOptions,
                  value: error || result
                },
                "source": "fetchExchange"
              }) : void 0;
            })(source);
          }
          return source;
        })(wonka.filter((operation) => {
          return operation.kind !== "teardown" && (operation.kind !== "subscription" || !!operation.context.fetchSubscriptions);
        })(ops$));
        var forward$ = forward(wonka.filter((operation) => {
          return operation.kind === "teardown" || operation.kind === "subscription" && !operation.context.fetchSubscriptions;
        })(ops$));
        return wonka.merge([fetchResults$, forward$]);
      };
    }, "fetchExchange");
    var composeExchanges = /* @__PURE__ */ __name((exchanges) => ({
      client,
      forward,
      dispatchDebug
    }) => exchanges.reduceRight((forward2, exchange) => {
      var forwarded = false;
      return exchange({
        client,
        forward(operations$) {
          if (process.env.NODE_ENV !== "production") {
            if (forwarded) throw new Error("forward() must only be called once in each Exchange.");
            forwarded = true;
          }
          return wonka.share(forward2(wonka.share(operations$)));
        },
        dispatchDebug(event) {
          process.env.NODE_ENV !== "production" ? dispatchDebug({
            timestamp: Date.now(),
            source: exchange.name,
            ...event
          }) : void 0;
        }
      });
    }, forward), "composeExchanges");
    var mapExchange = /* @__PURE__ */ __name(({
      onOperation,
      onResult,
      onError
    }) => {
      return ({
        forward
      }) => (ops$) => {
        return wonka.mergeMap((result) => {
          if (onError && result.error) onError(result.error, result.operation);
          var newResult = onResult && onResult(result) || result;
          return "then" in newResult ? wonka.fromPromise(newResult) : wonka.fromValue(newResult);
        })(forward(wonka.mergeMap((operation) => {
          var newOperation = onOperation && onOperation(operation) || operation;
          return "then" in newOperation ? wonka.fromPromise(newOperation) : wonka.fromValue(newOperation);
        })(ops$)));
      };
    }, "mapExchange");
    var fallbackExchange = /* @__PURE__ */ __name(({
      dispatchDebug
    }) => (ops$) => {
      if (process.env.NODE_ENV !== "production") {
        ops$ = wonka.tap((operation) => {
          if (operation.kind !== "teardown" && process.env.NODE_ENV !== "production") {
            var message = `No exchange has handled operations of kind "${operation.kind}". Check whether you've added an exchange responsible for these operations.`;
            process.env.NODE_ENV !== "production" ? dispatchDebug({
              type: "fallbackCatch",
              message,
              operation,
              "source": "fallbackExchange"
            }) : void 0;
            console.warn(message);
          }
        })(ops$);
      }
      return wonka.filter((_x) => false)(ops$);
    }, "fallbackExchange");
    var Client = /* @__PURE__ */ __name(function Client2(opts) {
      if (process.env.NODE_ENV !== "production" && !opts.url) {
        throw new Error("You are creating an urql-client without a url.");
      }
      var ids = 0;
      var replays = /* @__PURE__ */ new Map();
      var active = /* @__PURE__ */ new Map();
      var dispatched = /* @__PURE__ */ new Set();
      var queue = [];
      var baseOpts = {
        url: opts.url,
        fetchSubscriptions: opts.fetchSubscriptions,
        fetchOptions: opts.fetchOptions,
        fetch: opts.fetch,
        preferGetMethod: !!opts.preferGetMethod,
        requestPolicy: opts.requestPolicy || "cache-first"
      };
      var operations = wonka.makeSubject();
      function nextOperation(operation) {
        if (operation.kind === "mutation" || operation.kind === "teardown" || !dispatched.has(operation.key)) {
          if (operation.kind === "teardown") {
            dispatched.delete(operation.key);
          } else if (operation.kind !== "mutation") {
            dispatched.add(operation.key);
          }
          operations.next(operation);
        }
      }
      __name(nextOperation, "nextOperation");
      var isOperationBatchActive = false;
      function dispatchOperation(operation) {
        if (operation) nextOperation(operation);
        if (!isOperationBatchActive) {
          isOperationBatchActive = true;
          while (isOperationBatchActive && (operation = queue.shift())) nextOperation(operation);
          isOperationBatchActive = false;
        }
      }
      __name(dispatchOperation, "dispatchOperation");
      var makeResultSource = /* @__PURE__ */ __name((operation) => {
        var result$ = (
          // End the results stream when an active teardown event is sent
          wonka.takeUntil(wonka.filter((op) => op.kind === "teardown" && op.key === operation.key)(operations.source))(
            // Filter by matching key (or _instance if it’s set)
            wonka.filter((res) => res.operation.kind === operation.kind && res.operation.key === operation.key && (!res.operation.context._instance || res.operation.context._instance === operation.context._instance))(results$)
          )
        );
        if (opts.maskTypename) {
          result$ = wonka.map((res) => ({
            ...res,
            data: maskTypename(res.data, true)
          }))(result$);
        }
        if (operation.kind !== "query") {
          result$ = wonka.takeWhile((result) => !!result.hasNext, true)(result$);
        } else {
          result$ = // Add `stale: true` flag when a new operation is sent for queries
          wonka.switchMap((result) => {
            var value$ = wonka.fromValue(result);
            return result.stale || result.hasNext ? value$ : wonka.merge([value$, wonka.map(() => {
              result.stale = true;
              return result;
            })(wonka.take(1)(wonka.filter((op) => op.key === operation.key)(operations.source)))]);
          })(result$);
        }
        if (operation.kind !== "mutation") {
          result$ = // Cleanup active states on end of source
          wonka.onEnd(() => {
            dispatched.delete(operation.key);
            replays.delete(operation.key);
            active.delete(operation.key);
            isOperationBatchActive = false;
            for (var i = queue.length - 1; i >= 0; i--) if (queue[i].key === operation.key) queue.splice(i, 1);
            nextOperation(makeOperation("teardown", operation, operation.context));
          })(
            // Store replay result
            wonka.onPush((result) => {
              if (result.stale) {
                for (var _operation of queue) {
                  if (_operation.key === result.operation.key) {
                    dispatched.delete(_operation.key);
                    break;
                  }
                }
              } else if (!result.hasNext) {
                dispatched.delete(operation.key);
              }
              replays.set(operation.key, result);
            })(result$)
          );
        } else {
          result$ = // Send mutation operation on start
          wonka.onStart(() => {
            nextOperation(operation);
          })(result$);
        }
        return wonka.share(result$);
      }, "makeResultSource");
      var instance = this instanceof Client2 ? this : Object.create(Client2.prototype);
      var client = Object.assign(instance, {
        suspense: !!opts.suspense,
        operations$: operations.source,
        reexecuteOperation(operation) {
          if (operation.kind === "teardown") {
            dispatchOperation(operation);
          } else if (operation.kind === "mutation" || active.has(operation.key)) {
            var queued = false;
            for (var i = 0; i < queue.length; i++) queued = queued || queue[i].key === operation.key;
            if (!queued) dispatched.delete(operation.key);
            queue.push(operation);
            Promise.resolve().then(dispatchOperation);
          }
        },
        createRequestOperation(kind, request, opts2) {
          if (!opts2) opts2 = {};
          var requestOperationType;
          if (process.env.NODE_ENV !== "production" && kind !== "teardown" && (requestOperationType = fetchSource.getOperationType(request.query)) !== kind) {
            throw new Error(`Expected operation of type "${kind}" but found "${requestOperationType}"`);
          }
          return makeOperation(kind, request, {
            _instance: kind === "mutation" ? ids = ids + 1 | 0 : void 0,
            ...baseOpts,
            ...opts2,
            requestPolicy: opts2.requestPolicy || baseOpts.requestPolicy,
            suspense: opts2.suspense || opts2.suspense !== false && client.suspense
          });
        },
        executeRequestOperation(operation) {
          if (operation.kind === "mutation") {
            return withPromise(makeResultSource(operation));
          }
          return withPromise(wonka.lazy(() => {
            var source2 = active.get(operation.key);
            if (!source2) {
              active.set(operation.key, source2 = makeResultSource(operation));
            }
            source2 = wonka.onStart(() => {
              dispatchOperation(operation);
            })(source2);
            var replay = replays.get(operation.key);
            if (operation.kind === "query" && replay && (replay.stale || replay.hasNext)) {
              return wonka.switchMap(wonka.fromValue)(wonka.merge([source2, wonka.filter((replay2) => replay2 === replays.get(operation.key))(wonka.fromValue(replay))]));
            } else {
              return source2;
            }
          }));
        },
        executeQuery(query, opts2) {
          var operation = client.createRequestOperation("query", query, opts2);
          return client.executeRequestOperation(operation);
        },
        executeSubscription(query, opts2) {
          var operation = client.createRequestOperation("subscription", query, opts2);
          return client.executeRequestOperation(operation);
        },
        executeMutation(query, opts2) {
          var operation = client.createRequestOperation("mutation", query, opts2);
          return client.executeRequestOperation(operation);
        },
        readQuery(query, variables, context) {
          var result = null;
          wonka.subscribe((res) => {
            result = res;
          })(client.query(query, variables, context)).unsubscribe();
          return result;
        },
        query(query, variables, context) {
          return client.executeQuery(fetchSource.createRequest(query, variables), context);
        },
        subscription(query, variables, context) {
          return client.executeSubscription(fetchSource.createRequest(query, variables), context);
        },
        mutation(query, variables, context) {
          return client.executeMutation(fetchSource.createRequest(query, variables), context);
        }
      });
      var dispatchDebug = noop;
      if (process.env.NODE_ENV !== "production") {
        var {
          next,
          source
        } = wonka.makeSubject();
        client.subscribeToDebugTarget = (onEvent) => wonka.subscribe(onEvent)(source);
        dispatchDebug = next;
      }
      var composedExchange = composeExchanges(opts.exchanges);
      var results$ = wonka.share(composedExchange({
        client,
        dispatchDebug,
        forward: fallbackExchange({
          dispatchDebug
        })
      })(operations.source));
      wonka.publish(results$);
      return client;
    }, "Client");
    var createClient2 = Client;
    exports.CombinedError = fetchSource.CombinedError;
    exports.createRequest = fetchSource.createRequest;
    exports.makeErrorResult = fetchSource.makeErrorResult;
    exports.makeResult = fetchSource.makeResult;
    exports.mergeResultPatch = fetchSource.mergeResultPatch;
    exports.stringifyDocument = fetchSource.stringifyDocument;
    exports.stringifyVariables = fetchSource.stringifyVariables;
    exports.Client = Client;
    exports.cacheExchange = cacheExchange2;
    exports.composeExchanges = composeExchanges;
    exports.createClient = createClient2;
    exports.debugExchange = debugExchange;
    exports.dedupExchange = dedupExchange;
    exports.errorExchange = mapExchange;
    exports.fetchExchange = fetchExchange2;
    exports.formatDocument = formatDocument;
    exports.gql = gql;
    exports.makeOperation = makeOperation;
    exports.mapExchange = mapExchange;
    exports.maskTypename = maskTypename;
    exports.ssrExchange = ssrExchange;
    exports.subscriptionExchange = subscriptionExchange;
  }
});

// node_modules/.pnpm/react@18.3.1/node_modules/react/cjs/react.production.min.js
var require_react_production_min = __commonJS({
  "node_modules/.pnpm/react@18.3.1/node_modules/react/cjs/react.production.min.js"(exports) {
    "use strict";
    init_esm();
    var l = Symbol.for("react.element");
    var n = Symbol.for("react.portal");
    var p = Symbol.for("react.fragment");
    var q = Symbol.for("react.strict_mode");
    var r = Symbol.for("react.profiler");
    var t = Symbol.for("react.provider");
    var u = Symbol.for("react.context");
    var v = Symbol.for("react.forward_ref");
    var w = Symbol.for("react.suspense");
    var x = Symbol.for("react.memo");
    var y = Symbol.for("react.lazy");
    var z = Symbol.iterator;
    function A(a) {
      if (null === a || "object" !== typeof a) return null;
      a = z && a[z] || a["@@iterator"];
      return "function" === typeof a ? a : null;
    }
    __name(A, "A");
    var B = { isMounted: /* @__PURE__ */ __name(function() {
      return false;
    }, "isMounted"), enqueueForceUpdate: /* @__PURE__ */ __name(function() {
    }, "enqueueForceUpdate"), enqueueReplaceState: /* @__PURE__ */ __name(function() {
    }, "enqueueReplaceState"), enqueueSetState: /* @__PURE__ */ __name(function() {
    }, "enqueueSetState") };
    var C = Object.assign;
    var D = {};
    function E(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    __name(E, "E");
    E.prototype.isReactComponent = {};
    E.prototype.setState = function(a, b) {
      if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, a, b, "setState");
    };
    E.prototype.forceUpdate = function(a) {
      this.updater.enqueueForceUpdate(this, a, "forceUpdate");
    };
    function F() {
    }
    __name(F, "F");
    F.prototype = E.prototype;
    function G(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    __name(G, "G");
    var H = G.prototype = new F();
    H.constructor = G;
    C(H, E.prototype);
    H.isPureReactComponent = true;
    var I = Array.isArray;
    var J = Object.prototype.hasOwnProperty;
    var K = { current: null };
    var L = { key: true, ref: true, __self: true, __source: true };
    function M(a, b, e) {
      var d, c = {}, k = null, h = null;
      if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
      var g = arguments.length - 2;
      if (1 === g) c.children = e;
      else if (1 < g) {
        for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
        c.children = f;
      }
      if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
      return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
    }
    __name(M, "M");
    function N(a, b) {
      return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
    }
    __name(N, "N");
    function O(a) {
      return "object" === typeof a && null !== a && a.$$typeof === l;
    }
    __name(O, "O");
    function escape(a) {
      var b = { "=": "=0", ":": "=2" };
      return "$" + a.replace(/[=:]/g, function(a2) {
        return b[a2];
      });
    }
    __name(escape, "escape");
    var P = /\/+/g;
    function Q(a, b) {
      return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
    }
    __name(Q, "Q");
    function R(a, b, e, d, c) {
      var k = typeof a;
      if ("undefined" === k || "boolean" === k) a = null;
      var h = false;
      if (null === a) h = true;
      else switch (k) {
        case "string":
        case "number":
          h = true;
          break;
        case "object":
          switch (a.$$typeof) {
            case l:
            case n:
              h = true;
          }
      }
      if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
        return a2;
      })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
      h = 0;
      d = "" === d ? "." : d + ":";
      if (I(a)) for (var g = 0; g < a.length; g++) {
        k = a[g];
        var f = d + Q(k, g);
        h += R(k, b, e, f, c);
      }
      else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
      else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
      return h;
    }
    __name(R, "R");
    function S(a, b, e) {
      if (null == a) return a;
      var d = [], c = 0;
      R(a, d, "", "", function(a2) {
        return b.call(e, a2, c++);
      });
      return d;
    }
    __name(S, "S");
    function T(a) {
      if (-1 === a._status) {
        var b = a._result;
        b = b();
        b.then(function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
        }, function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
        });
        -1 === a._status && (a._status = 0, a._result = b);
      }
      if (1 === a._status) return a._result.default;
      throw a._result;
    }
    __name(T, "T");
    var U = { current: null };
    var V = { transition: null };
    var W = { ReactCurrentDispatcher: U, ReactCurrentBatchConfig: V, ReactCurrentOwner: K };
    function X() {
      throw Error("act(...) is not supported in production builds of React.");
    }
    __name(X, "X");
    exports.Children = { map: S, forEach: /* @__PURE__ */ __name(function(a, b, e) {
      S(a, function() {
        b.apply(this, arguments);
      }, e);
    }, "forEach"), count: /* @__PURE__ */ __name(function(a) {
      var b = 0;
      S(a, function() {
        b++;
      });
      return b;
    }, "count"), toArray: /* @__PURE__ */ __name(function(a) {
      return S(a, function(a2) {
        return a2;
      }) || [];
    }, "toArray"), only: /* @__PURE__ */ __name(function(a) {
      if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
      return a;
    }, "only") };
    exports.Component = E;
    exports.Fragment = p;
    exports.Profiler = r;
    exports.PureComponent = G;
    exports.StrictMode = q;
    exports.Suspense = w;
    exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
    exports.act = X;
    exports.cloneElement = function(a, b, e) {
      if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
      var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
      if (null != b) {
        void 0 !== b.ref && (k = b.ref, h = K.current);
        void 0 !== b.key && (c = "" + b.key);
        if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
        for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
      }
      var f = arguments.length - 2;
      if (1 === f) d.children = e;
      else if (1 < f) {
        g = Array(f);
        for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
        d.children = g;
      }
      return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
    };
    exports.createContext = function(a) {
      a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
      a.Provider = { $$typeof: t, _context: a };
      return a.Consumer = a;
    };
    exports.createElement = M;
    exports.createFactory = function(a) {
      var b = M.bind(null, a);
      b.type = a;
      return b;
    };
    exports.createRef = function() {
      return { current: null };
    };
    exports.forwardRef = function(a) {
      return { $$typeof: v, render: a };
    };
    exports.isValidElement = O;
    exports.lazy = function(a) {
      return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T };
    };
    exports.memo = function(a, b) {
      return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
    };
    exports.startTransition = function(a) {
      var b = V.transition;
      V.transition = {};
      try {
        a();
      } finally {
        V.transition = b;
      }
    };
    exports.unstable_act = X;
    exports.useCallback = function(a, b) {
      return U.current.useCallback(a, b);
    };
    exports.useContext = function(a) {
      return U.current.useContext(a);
    };
    exports.useDebugValue = function() {
    };
    exports.useDeferredValue = function(a) {
      return U.current.useDeferredValue(a);
    };
    exports.useEffect = function(a, b) {
      return U.current.useEffect(a, b);
    };
    exports.useId = function() {
      return U.current.useId();
    };
    exports.useImperativeHandle = function(a, b, e) {
      return U.current.useImperativeHandle(a, b, e);
    };
    exports.useInsertionEffect = function(a, b) {
      return U.current.useInsertionEffect(a, b);
    };
    exports.useLayoutEffect = function(a, b) {
      return U.current.useLayoutEffect(a, b);
    };
    exports.useMemo = function(a, b) {
      return U.current.useMemo(a, b);
    };
    exports.useReducer = function(a, b, e) {
      return U.current.useReducer(a, b, e);
    };
    exports.useRef = function(a) {
      return U.current.useRef(a);
    };
    exports.useState = function(a) {
      return U.current.useState(a);
    };
    exports.useSyncExternalStore = function(a, b, e) {
      return U.current.useSyncExternalStore(a, b, e);
    };
    exports.useTransition = function() {
      return U.current.useTransition();
    };
    exports.version = "18.3.1";
  }
});

// node_modules/.pnpm/react@18.3.1/node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/.pnpm/react@18.3.1/node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    init_esm();
    if (process.env.NODE_ENV !== "production") {
      (function() {
        "use strict";
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var ReactVersion = "18.3.1";
        var REACT_ELEMENT_TYPE = Symbol.for("react.element");
        var REACT_PORTAL_TYPE = Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = Symbol.for("react.memo");
        var REACT_LAZY_TYPE = Symbol.for("react.lazy");
        var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        __name(getIteratorFn, "getIteratorFn");
        var ReactCurrentDispatcher = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactCurrentBatchConfig = {
          transition: null
        };
        var ReactCurrentActQueue = {
          current: null,
          // Used to reproduce behavior of `batchedUpdates` in legacy mode.
          isBatchingLegacy: false,
          didScheduleLegacyUpdate: false
        };
        var ReactCurrentOwner = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactDebugCurrentFrame = {};
        var currentExtraStackFrame = null;
        function setExtraStackFrame(stack) {
          {
            currentExtraStackFrame = stack;
          }
        }
        __name(setExtraStackFrame, "setExtraStackFrame");
        {
          ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
            {
              currentExtraStackFrame = stack;
            }
          };
          ReactDebugCurrentFrame.getCurrentStack = null;
          ReactDebugCurrentFrame.getStackAddendum = function() {
            var stack = "";
            if (currentExtraStackFrame) {
              stack += currentExtraStackFrame;
            }
            var impl = ReactDebugCurrentFrame.getCurrentStack;
            if (impl) {
              stack += impl() || "";
            }
            return stack;
          };
        }
        var enableScopeAPI = false;
        var enableCacheElement = false;
        var enableTransitionTracing = false;
        var enableLegacyHidden = false;
        var enableDebugTracing = false;
        var ReactSharedInternals = {
          ReactCurrentDispatcher,
          ReactCurrentBatchConfig,
          ReactCurrentOwner
        };
        {
          ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
          ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
        }
        function warn(format) {
          {
            {
              for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
              }
              printWarning("warn", format, args);
            }
          }
        }
        __name(warn, "warn");
        function error(format) {
          {
            {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format, args);
            }
          }
        }
        __name(error, "error");
        function printWarning(level, format, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item) {
              return String(item);
            });
            argsWithFormat.unshift("Warning: " + format);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        __name(printWarning, "printWarning");
        var didWarnStateUpdateForUnmountedComponent = {};
        function warnNoop(publicInstance, callerName) {
          {
            var _constructor = publicInstance.constructor;
            var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
            var warningKey = componentName + "." + callerName;
            if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
              return;
            }
            error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
            didWarnStateUpdateForUnmountedComponent[warningKey] = true;
          }
        }
        __name(warnNoop, "warnNoop");
        var ReactNoopUpdateQueue = {
          /**
           * Checks whether or not this composite component is mounted.
           * @param {ReactClass} publicInstance The instance we want to test.
           * @return {boolean} True if mounted, false otherwise.
           * @protected
           * @final
           */
          isMounted: /* @__PURE__ */ __name(function(publicInstance) {
            return false;
          }, "isMounted"),
          /**
           * Forces an update. This should only be invoked when it is known with
           * certainty that we are **not** in a DOM transaction.
           *
           * You may want to call this when you know that some deeper aspect of the
           * component's state has changed but `setState` was not called.
           *
           * This will not invoke `shouldComponentUpdate`, but it will invoke
           * `componentWillUpdate` and `componentDidUpdate`.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueForceUpdate: /* @__PURE__ */ __name(function(publicInstance, callback, callerName) {
            warnNoop(publicInstance, "forceUpdate");
          }, "enqueueForceUpdate"),
          /**
           * Replaces all of the state. Always use this or `setState` to mutate state.
           * You should treat `this.state` as immutable.
           *
           * There is no guarantee that `this.state` will be immediately updated, so
           * accessing `this.state` after calling this method may return the old value.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} completeState Next state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueReplaceState: /* @__PURE__ */ __name(function(publicInstance, completeState, callback, callerName) {
            warnNoop(publicInstance, "replaceState");
          }, "enqueueReplaceState"),
          /**
           * Sets a subset of the state. This only exists because _pendingState is
           * internal. This provides a merging strategy that is not available to deep
           * properties which is confusing. TODO: Expose pendingState or don't use it
           * during the merge.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} partialState Next partial state to be merged with state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} Name of the calling function in the public API.
           * @internal
           */
          enqueueSetState: /* @__PURE__ */ __name(function(publicInstance, partialState, callback, callerName) {
            warnNoop(publicInstance, "setState");
          }, "enqueueSetState")
        };
        var assign = Object.assign;
        var emptyObject = {};
        {
          Object.freeze(emptyObject);
        }
        function Component(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        __name(Component, "Component");
        Component.prototype.isReactComponent = {};
        Component.prototype.setState = function(partialState, callback) {
          if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) {
            throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
          }
          this.updater.enqueueSetState(this, partialState, callback, "setState");
        };
        Component.prototype.forceUpdate = function(callback) {
          this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
        };
        {
          var deprecatedAPIs = {
            isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
            replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
          };
          var defineDeprecationWarning = /* @__PURE__ */ __name(function(methodName, info) {
            Object.defineProperty(Component.prototype, methodName, {
              get: /* @__PURE__ */ __name(function() {
                warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
                return void 0;
              }, "get")
            });
          }, "defineDeprecationWarning");
          for (var fnName in deprecatedAPIs) {
            if (deprecatedAPIs.hasOwnProperty(fnName)) {
              defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
            }
          }
        }
        function ComponentDummy() {
        }
        __name(ComponentDummy, "ComponentDummy");
        ComponentDummy.prototype = Component.prototype;
        function PureComponent(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        __name(PureComponent, "PureComponent");
        var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
        pureComponentPrototype.constructor = PureComponent;
        assign(pureComponentPrototype, Component.prototype);
        pureComponentPrototype.isPureReactComponent = true;
        function createRef() {
          var refObject = {
            current: null
          };
          {
            Object.seal(refObject);
          }
          return refObject;
        }
        __name(createRef, "createRef");
        var isArrayImpl = Array.isArray;
        function isArray(a) {
          return isArrayImpl(a);
        }
        __name(isArray, "isArray");
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type;
          }
        }
        __name(typeName, "typeName");
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e) {
              return true;
            }
          }
        }
        __name(willCoercionThrow, "willCoercionThrow");
        function testStringCoercion(value) {
          return "" + value;
        }
        __name(testStringCoercion, "testStringCoercion");
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        __name(checkKeyStringCoercion, "checkKeyStringCoercion");
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        __name(getWrappedName, "getWrappedName");
        function getContextName(type) {
          return type.displayName || "Context";
        }
        __name(getContextName, "getContextName");
        function getComponentNameFromType(type) {
          if (type == null) {
            return null;
          }
          {
            if (typeof type.tag === "number") {
              error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type === "function") {
            return type.displayName || type.name || null;
          }
          if (typeof type === "string") {
            return type;
          }
          switch (type) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type, type.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        __name(getComponentNameFromType, "getComponentNameFromType");
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var RESERVED_PROPS = {
          key: true,
          ref: true,
          __self: true,
          __source: true
        };
        var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;
        {
          didWarnAboutStringRefs = {};
        }
        function hasValidRef(config) {
          {
            if (hasOwnProperty.call(config, "ref")) {
              var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.ref !== void 0;
        }
        __name(hasValidRef, "hasValidRef");
        function hasValidKey(config) {
          {
            if (hasOwnProperty.call(config, "key")) {
              var getter = Object.getOwnPropertyDescriptor(config, "key").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.key !== void 0;
        }
        __name(hasValidKey, "hasValidKey");
        function defineKeyPropWarningGetter(props, displayName) {
          var warnAboutAccessingKey = /* @__PURE__ */ __name(function() {
            {
              if (!specialPropKeyWarningShown) {
                specialPropKeyWarningShown = true;
                error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          }, "warnAboutAccessingKey");
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
        __name(defineKeyPropWarningGetter, "defineKeyPropWarningGetter");
        function defineRefPropWarningGetter(props, displayName) {
          var warnAboutAccessingRef = /* @__PURE__ */ __name(function() {
            {
              if (!specialPropRefWarningShown) {
                specialPropRefWarningShown = true;
                error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          }, "warnAboutAccessingRef");
          warnAboutAccessingRef.isReactWarning = true;
          Object.defineProperty(props, "ref", {
            get: warnAboutAccessingRef,
            configurable: true
          });
        }
        __name(defineRefPropWarningGetter, "defineRefPropWarningGetter");
        function warnIfStringRefCannotBeAutoConverted(config) {
          {
            if (typeof config.ref === "string" && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
              var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (!didWarnAboutStringRefs[componentName]) {
                error('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, config.ref);
                didWarnAboutStringRefs[componentName] = true;
              }
            }
          }
        }
        __name(warnIfStringRefCannotBeAutoConverted, "warnIfStringRefCannotBeAutoConverted");
        var ReactElement = /* @__PURE__ */ __name(function(type, key, ref, self, source, owner, props) {
          var element = {
            // This tag allows us to uniquely identify this as a React Element
            $$typeof: REACT_ELEMENT_TYPE,
            // Built-in properties that belong on the element
            type,
            key,
            ref,
            props,
            // Record the component responsible for creating this element.
            _owner: owner
          };
          {
            element._store = {};
            Object.defineProperty(element._store, "validated", {
              configurable: false,
              enumerable: false,
              writable: true,
              value: false
            });
            Object.defineProperty(element, "_self", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: self
            });
            Object.defineProperty(element, "_source", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: source
            });
            if (Object.freeze) {
              Object.freeze(element.props);
              Object.freeze(element);
            }
          }
          return element;
        }, "ReactElement");
        function createElement(type, config, children) {
          var propName;
          var props = {};
          var key = null;
          var ref = null;
          var self = null;
          var source = null;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              {
                warnIfStringRefCannotBeAutoConverted(config);
              }
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            self = config.__self === void 0 ? null : config.__self;
            source = config.__source === void 0 ? null : config.__source;
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config[propName];
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            {
              if (Object.freeze) {
                Object.freeze(childArray);
              }
            }
            props.children = childArray;
          }
          if (type && type.defaultProps) {
            var defaultProps = type.defaultProps;
            for (propName in defaultProps) {
              if (props[propName] === void 0) {
                props[propName] = defaultProps[propName];
              }
            }
          }
          {
            if (key || ref) {
              var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
              if (key) {
                defineKeyPropWarningGetter(props, displayName);
              }
              if (ref) {
                defineRefPropWarningGetter(props, displayName);
              }
            }
          }
          return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
        }
        __name(createElement, "createElement");
        function cloneAndReplaceKey(oldElement, newKey) {
          var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
          return newElement;
        }
        __name(cloneAndReplaceKey, "cloneAndReplaceKey");
        function cloneElement(element, config, children) {
          if (element === null || element === void 0) {
            throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
          }
          var propName;
          var props = assign({}, element.props);
          var key = element.key;
          var ref = element.ref;
          var self = element._self;
          var source = element._source;
          var owner = element._owner;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              owner = ReactCurrentOwner.current;
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            var defaultProps;
            if (element.type && element.type.defaultProps) {
              defaultProps = element.type.defaultProps;
            }
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                if (config[propName] === void 0 && defaultProps !== void 0) {
                  props[propName] = defaultProps[propName];
                } else {
                  props[propName] = config[propName];
                }
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            props.children = childArray;
          }
          return ReactElement(element.type, key, ref, self, source, owner, props);
        }
        __name(cloneElement, "cloneElement");
        function isValidElement(object) {
          return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
        }
        __name(isValidElement, "isValidElement");
        var SEPARATOR = ".";
        var SUBSEPARATOR = ":";
        function escape(key) {
          var escapeRegex = /[=:]/g;
          var escaperLookup = {
            "=": "=0",
            ":": "=2"
          };
          var escapedString = key.replace(escapeRegex, function(match) {
            return escaperLookup[match];
          });
          return "$" + escapedString;
        }
        __name(escape, "escape");
        var didWarnAboutMaps = false;
        var userProvidedKeyEscapeRegex = /\/+/g;
        function escapeUserProvidedKey(text) {
          return text.replace(userProvidedKeyEscapeRegex, "$&/");
        }
        __name(escapeUserProvidedKey, "escapeUserProvidedKey");
        function getElementKey(element, index) {
          if (typeof element === "object" && element !== null && element.key != null) {
            {
              checkKeyStringCoercion(element.key);
            }
            return escape("" + element.key);
          }
          return index.toString(36);
        }
        __name(getElementKey, "getElementKey");
        function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
          var type = typeof children;
          if (type === "undefined" || type === "boolean") {
            children = null;
          }
          var invokeCallback = false;
          if (children === null) {
            invokeCallback = true;
          } else {
            switch (type) {
              case "string":
              case "number":
                invokeCallback = true;
                break;
              case "object":
                switch (children.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    invokeCallback = true;
                }
            }
          }
          if (invokeCallback) {
            var _child = children;
            var mappedChild = callback(_child);
            var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
            if (isArray(mappedChild)) {
              var escapedChildKey = "";
              if (childKey != null) {
                escapedChildKey = escapeUserProvidedKey(childKey) + "/";
              }
              mapIntoArray(mappedChild, array, escapedChildKey, "", function(c) {
                return c;
              });
            } else if (mappedChild != null) {
              if (isValidElement(mappedChild)) {
                {
                  if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
                    checkKeyStringCoercion(mappedChild.key);
                  }
                }
                mappedChild = cloneAndReplaceKey(
                  mappedChild,
                  // Keep both the (mapped) and old keys if they differ, just as
                  // traverseAllChildren used to do for objects as children
                  escapedPrefix + // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
                  (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? (
                    // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
                    // eslint-disable-next-line react-internal/safe-string-coercion
                    escapeUserProvidedKey("" + mappedChild.key) + "/"
                  ) : "") + childKey
                );
              }
              array.push(mappedChild);
            }
            return 1;
          }
          var child;
          var nextName;
          var subtreeCount = 0;
          var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
          if (isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              child = children[i];
              nextName = nextNamePrefix + getElementKey(child, i);
              subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
            }
          } else {
            var iteratorFn = getIteratorFn(children);
            if (typeof iteratorFn === "function") {
              var iterableChildren = children;
              {
                if (iteratorFn === iterableChildren.entries) {
                  if (!didWarnAboutMaps) {
                    warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                  }
                  didWarnAboutMaps = true;
                }
              }
              var iterator = iteratorFn.call(iterableChildren);
              var step;
              var ii = 0;
              while (!(step = iterator.next()).done) {
                child = step.value;
                nextName = nextNamePrefix + getElementKey(child, ii++);
                subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
              }
            } else if (type === "object") {
              var childrenString = String(children);
              throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
            }
          }
          return subtreeCount;
        }
        __name(mapIntoArray, "mapIntoArray");
        function mapChildren(children, func, context) {
          if (children == null) {
            return children;
          }
          var result = [];
          var count = 0;
          mapIntoArray(children, result, "", "", function(child) {
            return func.call(context, child, count++);
          });
          return result;
        }
        __name(mapChildren, "mapChildren");
        function countChildren(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        }
        __name(countChildren, "countChildren");
        function forEachChildren(children, forEachFunc, forEachContext) {
          mapChildren(children, function() {
            forEachFunc.apply(this, arguments);
          }, forEachContext);
        }
        __name(forEachChildren, "forEachChildren");
        function toArray(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        }
        __name(toArray, "toArray");
        function onlyChild(children) {
          if (!isValidElement(children)) {
            throw new Error("React.Children.only expected to receive a single React element child.");
          }
          return children;
        }
        __name(onlyChild, "onlyChild");
        function createContext(defaultValue) {
          var context = {
            $$typeof: REACT_CONTEXT_TYPE,
            // As a workaround to support multiple concurrent renderers, we categorize
            // some renderers as primary and others as secondary. We only expect
            // there to be two concurrent renderers at most: React Native (primary) and
            // Fabric (secondary); React DOM (primary) and React ART (secondary).
            // Secondary renderers store their context values on separate fields.
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            // Used to track how many concurrent renderers this context currently
            // supports within in a single renderer. Such as parallel server rendering.
            _threadCount: 0,
            // These are circular
            Provider: null,
            Consumer: null,
            // Add these to use same hidden class in VM as ServerContext
            _defaultValue: null,
            _globalName: null
          };
          context.Provider = {
            $$typeof: REACT_PROVIDER_TYPE,
            _context: context
          };
          var hasWarnedAboutUsingNestedContextConsumers = false;
          var hasWarnedAboutUsingConsumerProvider = false;
          var hasWarnedAboutDisplayNameOnConsumer = false;
          {
            var Consumer = {
              $$typeof: REACT_CONTEXT_TYPE,
              _context: context
            };
            Object.defineProperties(Consumer, {
              Provider: {
                get: /* @__PURE__ */ __name(function() {
                  if (!hasWarnedAboutUsingConsumerProvider) {
                    hasWarnedAboutUsingConsumerProvider = true;
                    error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
                  }
                  return context.Provider;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_Provider) {
                  context.Provider = _Provider;
                }, "set")
              },
              _currentValue: {
                get: /* @__PURE__ */ __name(function() {
                  return context._currentValue;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_currentValue) {
                  context._currentValue = _currentValue;
                }, "set")
              },
              _currentValue2: {
                get: /* @__PURE__ */ __name(function() {
                  return context._currentValue2;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_currentValue2) {
                  context._currentValue2 = _currentValue2;
                }, "set")
              },
              _threadCount: {
                get: /* @__PURE__ */ __name(function() {
                  return context._threadCount;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_threadCount) {
                  context._threadCount = _threadCount;
                }, "set")
              },
              Consumer: {
                get: /* @__PURE__ */ __name(function() {
                  if (!hasWarnedAboutUsingNestedContextConsumers) {
                    hasWarnedAboutUsingNestedContextConsumers = true;
                    error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                  }
                  return context.Consumer;
                }, "get")
              },
              displayName: {
                get: /* @__PURE__ */ __name(function() {
                  return context.displayName;
                }, "get"),
                set: /* @__PURE__ */ __name(function(displayName) {
                  if (!hasWarnedAboutDisplayNameOnConsumer) {
                    warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
                    hasWarnedAboutDisplayNameOnConsumer = true;
                  }
                }, "set")
              }
            });
            context.Consumer = Consumer;
          }
          {
            context._currentRenderer = null;
            context._currentRenderer2 = null;
          }
          return context;
        }
        __name(createContext, "createContext");
        var Uninitialized = -1;
        var Pending = 0;
        var Resolved = 1;
        var Rejected = 2;
        function lazyInitializer(payload) {
          if (payload._status === Uninitialized) {
            var ctor = payload._result;
            var thenable = ctor();
            thenable.then(function(moduleObject2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var resolved = payload;
                resolved._status = Resolved;
                resolved._result = moduleObject2;
              }
            }, function(error2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var rejected = payload;
                rejected._status = Rejected;
                rejected._result = error2;
              }
            });
            if (payload._status === Uninitialized) {
              var pending = payload;
              pending._status = Pending;
              pending._result = thenable;
            }
          }
          if (payload._status === Resolved) {
            var moduleObject = payload._result;
            {
              if (moduleObject === void 0) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
              }
            }
            {
              if (!("default" in moduleObject)) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
              }
            }
            return moduleObject.default;
          } else {
            throw payload._result;
          }
        }
        __name(lazyInitializer, "lazyInitializer");
        function lazy(ctor) {
          var payload = {
            // We use these fields to store the result.
            _status: Uninitialized,
            _result: ctor
          };
          var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: payload,
            _init: lazyInitializer
          };
          {
            var defaultProps;
            var propTypes;
            Object.defineProperties(lazyType, {
              defaultProps: {
                configurable: true,
                get: /* @__PURE__ */ __name(function() {
                  return defaultProps;
                }, "get"),
                set: /* @__PURE__ */ __name(function(newDefaultProps) {
                  error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  defaultProps = newDefaultProps;
                  Object.defineProperty(lazyType, "defaultProps", {
                    enumerable: true
                  });
                }, "set")
              },
              propTypes: {
                configurable: true,
                get: /* @__PURE__ */ __name(function() {
                  return propTypes;
                }, "get"),
                set: /* @__PURE__ */ __name(function(newPropTypes) {
                  error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  propTypes = newPropTypes;
                  Object.defineProperty(lazyType, "propTypes", {
                    enumerable: true
                  });
                }, "set")
              }
            });
          }
          return lazyType;
        }
        __name(lazy, "lazy");
        function forwardRef(render) {
          {
            if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
              error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
            } else if (typeof render !== "function") {
              error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
            } else {
              if (render.length !== 0 && render.length !== 2) {
                error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
              }
            }
            if (render != null) {
              if (render.defaultProps != null || render.propTypes != null) {
                error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
              }
            }
          }
          var elementType = {
            $$typeof: REACT_FORWARD_REF_TYPE,
            render
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: /* @__PURE__ */ __name(function() {
                return ownName;
              }, "get"),
              set: /* @__PURE__ */ __name(function(name) {
                ownName = name;
                if (!render.name && !render.displayName) {
                  render.displayName = name;
                }
              }, "set")
            });
          }
          return elementType;
        }
        __name(forwardRef, "forwardRef");
        var REACT_MODULE_REFERENCE;
        {
          REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
        }
        function isValidElementType(type) {
          if (typeof type === "string" || typeof type === "function") {
            return true;
          }
          if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
            return true;
          }
          if (typeof type === "object" && type !== null) {
            if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
            // types supported by any Flight configuration anywhere since
            // we don't know which Flight build this will end up being used
            // with.
            type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) {
              return true;
            }
          }
          return false;
        }
        __name(isValidElementType, "isValidElementType");
        function memo(type, compare) {
          {
            if (!isValidElementType(type)) {
              error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
            }
          }
          var elementType = {
            $$typeof: REACT_MEMO_TYPE,
            type,
            compare: compare === void 0 ? null : compare
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: /* @__PURE__ */ __name(function() {
                return ownName;
              }, "get"),
              set: /* @__PURE__ */ __name(function(name) {
                ownName = name;
                if (!type.name && !type.displayName) {
                  type.displayName = name;
                }
              }, "set")
            });
          }
          return elementType;
        }
        __name(memo, "memo");
        function resolveDispatcher() {
          var dispatcher = ReactCurrentDispatcher.current;
          {
            if (dispatcher === null) {
              error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
            }
          }
          return dispatcher;
        }
        __name(resolveDispatcher, "resolveDispatcher");
        function useContext(Context) {
          var dispatcher = resolveDispatcher();
          {
            if (Context._context !== void 0) {
              var realContext = Context._context;
              if (realContext.Consumer === Context) {
                error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
              } else if (realContext.Provider === Context) {
                error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
              }
            }
          }
          return dispatcher.useContext(Context);
        }
        __name(useContext, "useContext");
        function useState(initialState) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useState(initialState);
        }
        __name(useState, "useState");
        function useReducer(reducer, initialArg, init) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useReducer(reducer, initialArg, init);
        }
        __name(useReducer, "useReducer");
        function useRef(initialValue) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useRef(initialValue);
        }
        __name(useRef, "useRef");
        function useEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useEffect(create, deps);
        }
        __name(useEffect, "useEffect");
        function useInsertionEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useInsertionEffect(create, deps);
        }
        __name(useInsertionEffect, "useInsertionEffect");
        function useLayoutEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useLayoutEffect(create, deps);
        }
        __name(useLayoutEffect, "useLayoutEffect");
        function useCallback(callback, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useCallback(callback, deps);
        }
        __name(useCallback, "useCallback");
        function useMemo(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useMemo(create, deps);
        }
        __name(useMemo, "useMemo");
        function useImperativeHandle(ref, create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useImperativeHandle(ref, create, deps);
        }
        __name(useImperativeHandle, "useImperativeHandle");
        function useDebugValue(value, formatterFn) {
          {
            var dispatcher = resolveDispatcher();
            return dispatcher.useDebugValue(value, formatterFn);
          }
        }
        __name(useDebugValue, "useDebugValue");
        function useTransition() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useTransition();
        }
        __name(useTransition, "useTransition");
        function useDeferredValue(value) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useDeferredValue(value);
        }
        __name(useDeferredValue, "useDeferredValue");
        function useId() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useId();
        }
        __name(useId, "useId");
        function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
        }
        __name(useSyncExternalStore, "useSyncExternalStore");
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        __name(disabledLog, "disabledLog");
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        __name(disableLogs, "disableLogs");
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign({}, props, {
                  value: prevLog
                }),
                info: assign({}, props, {
                  value: prevInfo
                }),
                warn: assign({}, props, {
                  value: prevWarn
                }),
                error: assign({}, props, {
                  value: prevError
                }),
                group: assign({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        __name(reenableLogs, "reenableLogs");
        var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x) {
                var match = x.stack.trim().match(/\n( *(at )?)/);
                prefix = match && match[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        __name(describeBuiltInComponentFrame, "describeBuiltInComponentFrame");
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher$1.current;
            ReactCurrentDispatcher$1.current = null;
            disableLogs();
          }
          try {
            if (construct) {
              var Fake = /* @__PURE__ */ __name(function() {
                throw Error();
              }, "Fake");
              Object.defineProperty(Fake.prototype, "props", {
                set: /* @__PURE__ */ __name(function() {
                  throw Error();
                }, "set")
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x) {
                  control = x;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x) {
                  control = x;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x) {
                control = x;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s = sampleLines.length - 1;
              var c = controlLines.length - 1;
              while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
                c--;
              }
              for (; s >= 1 && c >= 0; s--, c--) {
                if (sampleLines[s] !== controlLines[c]) {
                  if (s !== 1 || c !== 1) {
                    do {
                      s--;
                      c--;
                      if (c < 0 || sampleLines[s] !== controlLines[c]) {
                        var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s >= 1 && c >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher$1.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        __name(describeNativeComponentFrame, "describeNativeComponentFrame");
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        __name(describeFunctionComponentFrame, "describeFunctionComponentFrame");
        function shouldConstruct(Component2) {
          var prototype = Component2.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        __name(shouldConstruct, "shouldConstruct");
        function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
          if (type == null) {
            return "";
          }
          if (typeof type === "function") {
            {
              return describeNativeComponentFrame(type, shouldConstruct(type));
            }
          }
          if (typeof type === "string") {
            return describeBuiltInComponentFrame(type);
          }
          switch (type) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x) {
                }
              }
            }
          }
          return "";
        }
        __name(describeUnknownElementTypeFrameInDEV, "describeUnknownElementTypeFrameInDEV");
        var loggedTypeFailures = {};
        var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame$1.setExtraStackFrame(null);
            }
          }
        }
        __name(setCurrentlyValidatingElement, "setCurrentlyValidatingElement");
        function checkPropTypes(typeSpecs, values, location, componentName, element) {
          {
            var has = Function.call.bind(hasOwnProperty);
            for (var typeSpecName in typeSpecs) {
              if (has(typeSpecs, typeSpecName)) {
                var error$1 = void 0;
                try {
                  if (typeof typeSpecs[typeSpecName] !== "function") {
                    var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                    err.name = "Invariant Violation";
                    throw err;
                  }
                  error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                } catch (ex) {
                  error$1 = ex;
                }
                if (error$1 && !(error$1 instanceof Error)) {
                  setCurrentlyValidatingElement(element);
                  error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                  setCurrentlyValidatingElement(null);
                }
                if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                  loggedTypeFailures[error$1.message] = true;
                  setCurrentlyValidatingElement(element);
                  error("Failed %s type: %s", location, error$1.message);
                  setCurrentlyValidatingElement(null);
                }
              }
            }
          }
        }
        __name(checkPropTypes, "checkPropTypes");
        function setCurrentlyValidatingElement$1(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              setExtraStackFrame(stack);
            } else {
              setExtraStackFrame(null);
            }
          }
        }
        __name(setCurrentlyValidatingElement$1, "setCurrentlyValidatingElement$1");
        var propTypesMisspellWarningShown;
        {
          propTypesMisspellWarningShown = false;
        }
        function getDeclarationErrorAddendum() {
          if (ReactCurrentOwner.current) {
            var name = getComponentNameFromType(ReactCurrentOwner.current.type);
            if (name) {
              return "\n\nCheck the render method of `" + name + "`.";
            }
          }
          return "";
        }
        __name(getDeclarationErrorAddendum, "getDeclarationErrorAddendum");
        function getSourceInfoErrorAddendum(source) {
          if (source !== void 0) {
            var fileName = source.fileName.replace(/^.*[\\\/]/, "");
            var lineNumber = source.lineNumber;
            return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
          }
          return "";
        }
        __name(getSourceInfoErrorAddendum, "getSourceInfoErrorAddendum");
        function getSourceInfoErrorAddendumForProps(elementProps) {
          if (elementProps !== null && elementProps !== void 0) {
            return getSourceInfoErrorAddendum(elementProps.__source);
          }
          return "";
        }
        __name(getSourceInfoErrorAddendumForProps, "getSourceInfoErrorAddendumForProps");
        var ownerHasKeyUseWarning = {};
        function getCurrentComponentErrorInfo(parentType) {
          var info = getDeclarationErrorAddendum();
          if (!info) {
            var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
            if (parentName) {
              info = "\n\nCheck the top-level render call using <" + parentName + ">.";
            }
          }
          return info;
        }
        __name(getCurrentComponentErrorInfo, "getCurrentComponentErrorInfo");
        function validateExplicitKey(element, parentType) {
          if (!element._store || element._store.validated || element.key != null) {
            return;
          }
          element._store.validated = true;
          var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
          if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
            return;
          }
          ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
          var childOwner = "";
          if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
            childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
          }
          {
            setCurrentlyValidatingElement$1(element);
            error('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
            setCurrentlyValidatingElement$1(null);
          }
        }
        __name(validateExplicitKey, "validateExplicitKey");
        function validateChildKeys(node, parentType) {
          if (typeof node !== "object") {
            return;
          }
          if (isArray(node)) {
            for (var i = 0; i < node.length; i++) {
              var child = node[i];
              if (isValidElement(child)) {
                validateExplicitKey(child, parentType);
              }
            }
          } else if (isValidElement(node)) {
            if (node._store) {
              node._store.validated = true;
            }
          } else if (node) {
            var iteratorFn = getIteratorFn(node);
            if (typeof iteratorFn === "function") {
              if (iteratorFn !== node.entries) {
                var iterator = iteratorFn.call(node);
                var step;
                while (!(step = iterator.next()).done) {
                  if (isValidElement(step.value)) {
                    validateExplicitKey(step.value, parentType);
                  }
                }
              }
            }
          }
        }
        __name(validateChildKeys, "validateChildKeys");
        function validatePropTypes(element) {
          {
            var type = element.type;
            if (type === null || type === void 0 || typeof type === "string") {
              return;
            }
            var propTypes;
            if (typeof type === "function") {
              propTypes = type.propTypes;
            } else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
            // Inner props are checked in the reconciler.
            type.$$typeof === REACT_MEMO_TYPE)) {
              propTypes = type.propTypes;
            } else {
              return;
            }
            if (propTypes) {
              var name = getComponentNameFromType(type);
              checkPropTypes(propTypes, element.props, "prop", name, element);
            } else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
              propTypesMisspellWarningShown = true;
              var _name = getComponentNameFromType(type);
              error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
            }
            if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) {
              error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
            }
          }
        }
        __name(validatePropTypes, "validatePropTypes");
        function validateFragmentProps(fragment) {
          {
            var keys = Object.keys(fragment.props);
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              if (key !== "children" && key !== "key") {
                setCurrentlyValidatingElement$1(fragment);
                error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                setCurrentlyValidatingElement$1(null);
                break;
              }
            }
            if (fragment.ref !== null) {
              setCurrentlyValidatingElement$1(fragment);
              error("Invalid attribute `ref` supplied to `React.Fragment`.");
              setCurrentlyValidatingElement$1(null);
            }
          }
        }
        __name(validateFragmentProps, "validateFragmentProps");
        function createElementWithValidation(type, props, children) {
          var validType = isValidElementType(type);
          if (!validType) {
            var info = "";
            if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
              info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            }
            var sourceInfo = getSourceInfoErrorAddendumForProps(props);
            if (sourceInfo) {
              info += sourceInfo;
            } else {
              info += getDeclarationErrorAddendum();
            }
            var typeString;
            if (type === null) {
              typeString = "null";
            } else if (isArray(type)) {
              typeString = "array";
            } else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
              typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
              info = " Did you accidentally export a JSX literal instead of a component?";
            } else {
              typeString = typeof type;
            }
            {
              error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
            }
          }
          var element = createElement.apply(this, arguments);
          if (element == null) {
            return element;
          }
          if (validType) {
            for (var i = 2; i < arguments.length; i++) {
              validateChildKeys(arguments[i], type);
            }
          }
          if (type === REACT_FRAGMENT_TYPE) {
            validateFragmentProps(element);
          } else {
            validatePropTypes(element);
          }
          return element;
        }
        __name(createElementWithValidation, "createElementWithValidation");
        var didWarnAboutDeprecatedCreateFactory = false;
        function createFactoryWithValidation(type) {
          var validatedFactory = createElementWithValidation.bind(null, type);
          validatedFactory.type = type;
          {
            if (!didWarnAboutDeprecatedCreateFactory) {
              didWarnAboutDeprecatedCreateFactory = true;
              warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
            }
            Object.defineProperty(validatedFactory, "type", {
              enumerable: false,
              get: /* @__PURE__ */ __name(function() {
                warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
                Object.defineProperty(this, "type", {
                  value: type
                });
                return type;
              }, "get")
            });
          }
          return validatedFactory;
        }
        __name(createFactoryWithValidation, "createFactoryWithValidation");
        function cloneElementWithValidation(element, props, children) {
          var newElement = cloneElement.apply(this, arguments);
          for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], newElement.type);
          }
          validatePropTypes(newElement);
          return newElement;
        }
        __name(cloneElementWithValidation, "cloneElementWithValidation");
        function startTransition(scope, options) {
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = {};
          var currentTransition = ReactCurrentBatchConfig.transition;
          {
            ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
          }
          try {
            scope();
          } finally {
            ReactCurrentBatchConfig.transition = prevTransition;
            {
              if (prevTransition === null && currentTransition._updatedFibers) {
                var updatedFibersCount = currentTransition._updatedFibers.size;
                if (updatedFibersCount > 10) {
                  warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                }
                currentTransition._updatedFibers.clear();
              }
            }
          }
        }
        __name(startTransition, "startTransition");
        var didWarnAboutMessageChannel = false;
        var enqueueTaskImpl = null;
        function enqueueTask(task) {
          if (enqueueTaskImpl === null) {
            try {
              var requireString = ("require" + Math.random()).slice(0, 7);
              var nodeRequire = module && module[requireString];
              enqueueTaskImpl = nodeRequire.call(module, "timers").setImmediate;
            } catch (_err) {
              enqueueTaskImpl = /* @__PURE__ */ __name(function(callback) {
                {
                  if (didWarnAboutMessageChannel === false) {
                    didWarnAboutMessageChannel = true;
                    if (typeof MessageChannel === "undefined") {
                      error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
                    }
                  }
                }
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
              }, "enqueueTaskImpl");
            }
          }
          return enqueueTaskImpl(task);
        }
        __name(enqueueTask, "enqueueTask");
        var actScopeDepth = 0;
        var didWarnNoAwaitAct = false;
        function act(callback) {
          {
            var prevActScopeDepth = actScopeDepth;
            actScopeDepth++;
            if (ReactCurrentActQueue.current === null) {
              ReactCurrentActQueue.current = [];
            }
            var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
            var result;
            try {
              ReactCurrentActQueue.isBatchingLegacy = true;
              result = callback();
              if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
                var queue = ReactCurrentActQueue.current;
                if (queue !== null) {
                  ReactCurrentActQueue.didScheduleLegacyUpdate = false;
                  flushActQueue(queue);
                }
              }
            } catch (error2) {
              popActScope(prevActScopeDepth);
              throw error2;
            } finally {
              ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
            }
            if (result !== null && typeof result === "object" && typeof result.then === "function") {
              var thenableResult = result;
              var wasAwaited = false;
              var thenable = {
                then: /* @__PURE__ */ __name(function(resolve, reject) {
                  wasAwaited = true;
                  thenableResult.then(function(returnValue2) {
                    popActScope(prevActScopeDepth);
                    if (actScopeDepth === 0) {
                      recursivelyFlushAsyncActWork(returnValue2, resolve, reject);
                    } else {
                      resolve(returnValue2);
                    }
                  }, function(error2) {
                    popActScope(prevActScopeDepth);
                    reject(error2);
                  });
                }, "then")
              };
              {
                if (!didWarnNoAwaitAct && typeof Promise !== "undefined") {
                  Promise.resolve().then(function() {
                  }).then(function() {
                    if (!wasAwaited) {
                      didWarnNoAwaitAct = true;
                      error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
                    }
                  });
                }
              }
              return thenable;
            } else {
              var returnValue = result;
              popActScope(prevActScopeDepth);
              if (actScopeDepth === 0) {
                var _queue = ReactCurrentActQueue.current;
                if (_queue !== null) {
                  flushActQueue(_queue);
                  ReactCurrentActQueue.current = null;
                }
                var _thenable = {
                  then: /* @__PURE__ */ __name(function(resolve, reject) {
                    if (ReactCurrentActQueue.current === null) {
                      ReactCurrentActQueue.current = [];
                      recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                    } else {
                      resolve(returnValue);
                    }
                  }, "then")
                };
                return _thenable;
              } else {
                var _thenable2 = {
                  then: /* @__PURE__ */ __name(function(resolve, reject) {
                    resolve(returnValue);
                  }, "then")
                };
                return _thenable2;
              }
            }
          }
        }
        __name(act, "act");
        function popActScope(prevActScopeDepth) {
          {
            if (prevActScopeDepth !== actScopeDepth - 1) {
              error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
            }
            actScopeDepth = prevActScopeDepth;
          }
        }
        __name(popActScope, "popActScope");
        function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
          {
            var queue = ReactCurrentActQueue.current;
            if (queue !== null) {
              try {
                flushActQueue(queue);
                enqueueTask(function() {
                  if (queue.length === 0) {
                    ReactCurrentActQueue.current = null;
                    resolve(returnValue);
                  } else {
                    recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                  }
                });
              } catch (error2) {
                reject(error2);
              }
            } else {
              resolve(returnValue);
            }
          }
        }
        __name(recursivelyFlushAsyncActWork, "recursivelyFlushAsyncActWork");
        var isFlushing = false;
        function flushActQueue(queue) {
          {
            if (!isFlushing) {
              isFlushing = true;
              var i = 0;
              try {
                for (; i < queue.length; i++) {
                  var callback = queue[i];
                  do {
                    callback = callback(true);
                  } while (callback !== null);
                }
                queue.length = 0;
              } catch (error2) {
                queue = queue.slice(i + 1);
                throw error2;
              } finally {
                isFlushing = false;
              }
            }
          }
        }
        __name(flushActQueue, "flushActQueue");
        var createElement$1 = createElementWithValidation;
        var cloneElement$1 = cloneElementWithValidation;
        var createFactory = createFactoryWithValidation;
        var Children = {
          map: mapChildren,
          forEach: forEachChildren,
          count: countChildren,
          toArray,
          only: onlyChild
        };
        exports.Children = Children;
        exports.Component = Component;
        exports.Fragment = REACT_FRAGMENT_TYPE;
        exports.Profiler = REACT_PROFILER_TYPE;
        exports.PureComponent = PureComponent;
        exports.StrictMode = REACT_STRICT_MODE_TYPE;
        exports.Suspense = REACT_SUSPENSE_TYPE;
        exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
        exports.act = act;
        exports.cloneElement = cloneElement$1;
        exports.createContext = createContext;
        exports.createElement = createElement$1;
        exports.createFactory = createFactory;
        exports.createRef = createRef;
        exports.forwardRef = forwardRef;
        exports.isValidElement = isValidElement;
        exports.lazy = lazy;
        exports.memo = memo;
        exports.startTransition = startTransition;
        exports.unstable_act = act;
        exports.useCallback = useCallback;
        exports.useContext = useContext;
        exports.useDebugValue = useDebugValue;
        exports.useDeferredValue = useDeferredValue;
        exports.useEffect = useEffect;
        exports.useId = useId;
        exports.useImperativeHandle = useImperativeHandle;
        exports.useInsertionEffect = useInsertionEffect;
        exports.useLayoutEffect = useLayoutEffect;
        exports.useMemo = useMemo;
        exports.useReducer = useReducer;
        exports.useRef = useRef;
        exports.useState = useState;
        exports.useSyncExternalStore = useSyncExternalStore;
        exports.useTransition = useTransition;
        exports.version = ReactVersion;
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
        }
      })();
    }
  }
});

// node_modules/.pnpm/react@18.3.1/node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/.pnpm/react@18.3.1/node_modules/react/index.js"(exports, module) {
    "use strict";
    init_esm();
    if (process.env.NODE_ENV === "production") {
      module.exports = require_react_production_min();
    } else {
      module.exports = require_react_development();
    }
  }
});

// node_modules/.pnpm/urql@4.0.5_graphql@16.8.1_react@18.3.1/node_modules/urql/dist/urql.js
var require_urql = __commonJS({
  "node_modules/.pnpm/urql@4.0.5_graphql@16.8.1_react@18.3.1/node_modules/urql/dist/urql.js"(exports) {
    init_esm();
    Object.defineProperty(exports, "__esModule", { value: true });
    var core = require_urql_core();
    var React = require_react();
    var wonka = require_wonka();
    var OBJ = {};
    var Context = React.createContext(OBJ);
    var Provider = Context.Provider;
    var Consumer = Context.Consumer;
    Context.displayName = "UrqlContext";
    var useClient = /* @__PURE__ */ __name(() => {
      var client = React.useContext(Context);
      if (client === OBJ && process.env.NODE_ENV !== "production") {
        var error = "No client has been specified using urql's Provider. please create a client and add a Provider.";
        console.error(error);
        throw new Error(error);
      }
      return client;
    }, "useClient");
    var initialState = {
      fetching: false,
      stale: false,
      error: void 0,
      data: void 0,
      extensions: void 0,
      operation: void 0
    };
    var areOperationsEqual = /* @__PURE__ */ __name((a, b) => {
      return a === b || !!(a && b && a.key === b.key);
    }, "areOperationsEqual");
    var isShallowDifferent = /* @__PURE__ */ __name((a, b) => {
      for (var key in a) if (!(key in b)) return true;
      for (var _key in b) {
        if (_key === "operation" ? !areOperationsEqual(a[_key], b[_key]) : a[_key] !== b[_key]) {
          return true;
        }
      }
      return false;
    }, "isShallowDifferent");
    var computeNextState = /* @__PURE__ */ __name((prevState, result) => {
      var newState = {
        ...prevState,
        ...result,
        data: result.data !== void 0 || result.error ? result.data : prevState.data,
        fetching: !!result.fetching,
        stale: !!result.stale
      };
      return isShallowDifferent(prevState, newState) ? newState : prevState;
    }, "computeNextState");
    var hasDepsChanged = /* @__PURE__ */ __name((a, b) => {
      for (var i = 0, l = b.length; i < l; i++) if (a[i] !== b[i]) return true;
      return false;
    }, "hasDepsChanged");
    var reactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
    function deferDispatch(setState, value) {
      if (process.env.NODE_ENV !== "production" && !!reactSharedInternals && !!reactSharedInternals.ReactCurrentOwner && !!reactSharedInternals.ReactCurrentOwner.current) {
        Promise.resolve(value).then(setState);
      } else {
        setState(value);
      }
    }
    __name(deferDispatch, "deferDispatch");
    function useMutation(query) {
      var isMounted = React.useRef(true);
      var client = useClient();
      var [state, setState] = React.useState(initialState);
      var executeMutation = React.useCallback(
        (variables, context) => {
          deferDispatch(setState, {
            ...initialState,
            fetching: true
          });
          return wonka.toPromise(wonka.take(1)(wonka.filter((result) => !result.hasNext)(wonka.onPush((result) => {
            if (isMounted.current) {
              deferDispatch(setState, {
                fetching: false,
                stale: result.stale,
                data: result.data,
                error: result.error,
                extensions: result.extensions,
                operation: result.operation
              });
            }
          })(client.executeMutation(core.createRequest(query, variables), context || {})))));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [client, query, setState]
      );
      React.useEffect(() => {
        isMounted.current = true;
        return () => {
          isMounted.current = false;
        };
      }, []);
      return [state, executeMutation];
    }
    __name(useMutation, "useMutation");
    function useRequest(query, variables) {
      var prev = React.useRef(void 0);
      return React.useMemo(() => {
        var request = core.createRequest(query, variables);
        if (prev.current !== void 0 && prev.current.key === request.key) {
          return prev.current;
        } else {
          prev.current = request;
          return request;
        }
      }, [query, variables]);
    }
    __name(useRequest, "useRequest");
    var getCacheForClient = /* @__PURE__ */ __name((client) => {
      if (!client._react) {
        var reclaim = /* @__PURE__ */ new Set();
        var map = /* @__PURE__ */ new Map();
        if (client.operations$) {
          wonka.subscribe((operation) => {
            if (operation.kind === "teardown" && reclaim.has(operation.key)) {
              reclaim.delete(operation.key);
              map.delete(operation.key);
            }
          })(client.operations$);
        }
        client._react = {
          get(key) {
            return map.get(key);
          },
          set(key, value) {
            reclaim.delete(key);
            map.set(key, value);
          },
          dispose(key) {
            reclaim.add(key);
          }
        };
      }
      return client._react;
    }, "getCacheForClient");
    var isSuspense = /* @__PURE__ */ __name((client, context) => client.suspense && (!context || context.suspense !== false), "isSuspense");
    function useQuery(args) {
      var client = useClient();
      var cache = getCacheForClient(client);
      var suspense = isSuspense(client, args.context);
      var request = useRequest(args.query, args.variables);
      var source = React.useMemo(() => {
        if (args.pause) return null;
        var source2 = client.executeQuery(request, {
          requestPolicy: args.requestPolicy,
          ...args.context
        });
        return suspense ? wonka.onPush((result) => {
          cache.set(request.key, result);
        })(source2) : source2;
      }, [cache, client, request, suspense, args.pause, args.requestPolicy, args.context]);
      var getSnapshot = React.useCallback((source2, suspense2) => {
        if (!source2) return {
          fetching: false
        };
        var result = cache.get(request.key);
        if (!result) {
          var resolve;
          var subscription = wonka.subscribe((_result) => {
            result = _result;
            if (resolve) resolve(result);
          })(wonka.takeWhile(() => suspense2 && !resolve || !result)(source2));
          if (result == null && suspense2) {
            var promise = new Promise((_resolve) => {
              resolve = _resolve;
            });
            cache.set(request.key, promise);
            throw promise;
          } else {
            subscription.unsubscribe();
          }
        } else if (suspense2 && result != null && "then" in result) {
          throw result;
        }
        return result || {
          fetching: true
        };
      }, [cache, request]);
      var deps = [client, request, args.requestPolicy, args.context, args.pause];
      var [state, setState] = React.useState(() => [source, computeNextState(initialState, getSnapshot(source, suspense)), deps]);
      var currentResult = state[1];
      if (source !== state[0] && hasDepsChanged(state[2], deps)) {
        setState([source, currentResult = computeNextState(state[1], getSnapshot(source, suspense)), deps]);
      }
      React.useEffect(() => {
        var source2 = state[0];
        var request2 = state[2][1];
        var hasResult = false;
        var updateResult = /* @__PURE__ */ __name((result) => {
          hasResult = true;
          deferDispatch(setState, (state2) => {
            var nextResult = computeNextState(state2[1], result);
            return state2[1] !== nextResult ? [state2[0], nextResult, state2[2]] : state2;
          });
        }, "updateResult");
        if (source2) {
          var subscription = wonka.subscribe(updateResult)(wonka.onEnd(() => {
            updateResult({
              fetching: false
            });
          })(source2));
          if (!hasResult) updateResult({
            fetching: true
          });
          return () => {
            cache.dispose(request2.key);
            subscription.unsubscribe();
          };
        } else {
          updateResult({
            fetching: false
          });
        }
      }, [cache, state[0], state[2][1]]);
      var executeQuery = React.useCallback((opts) => {
        var context = {
          requestPolicy: args.requestPolicy,
          ...args.context,
          ...opts
        };
        deferDispatch(setState, (state2) => {
          var source2 = suspense ? wonka.onPush((result) => {
            cache.set(request.key, result);
          })(client.executeQuery(request, context)) : client.executeQuery(request, context);
          return [source2, state2[1], deps];
        });
      }, [client, cache, request, suspense, args.requestPolicy, args.context, args.pause]);
      return [currentResult, executeQuery];
    }
    __name(useQuery, "useQuery");
    function useSubscription(args, handler) {
      var client = useClient();
      var request = useRequest(args.query, args.variables);
      var handlerRef = React.useRef(handler);
      handlerRef.current = handler;
      var source = React.useMemo(() => !args.pause ? client.executeSubscription(request, args.context) : null, [client, request, args.pause, args.context]);
      var deps = [client, request, args.context, args.pause];
      var [state, setState] = React.useState(() => [source, {
        ...initialState,
        fetching: !!source
      }, deps]);
      var currentResult = state[1];
      if (source !== state[0] && hasDepsChanged(state[2], deps)) {
        setState([source, currentResult = computeNextState(state[1], {
          fetching: !!source
        }), deps]);
      }
      React.useEffect(() => {
        var updateResult = /* @__PURE__ */ __name((result) => {
          deferDispatch(setState, (state2) => {
            var nextResult = computeNextState(state2[1], result);
            if (state2[1] === nextResult) return state2;
            if (handlerRef.current && state2[1].data !== nextResult.data) {
              nextResult.data = handlerRef.current(state2[1].data, nextResult.data);
            }
            return [state2[0], nextResult, state2[2]];
          });
        }, "updateResult");
        if (state[0]) {
          return wonka.subscribe(updateResult)(wonka.onEnd(() => {
            updateResult({
              fetching: !!source
            });
          })(state[0])).unsubscribe;
        } else {
          updateResult({
            fetching: false
          });
        }
      }, [state[0]]);
      var executeSubscription = React.useCallback((opts) => {
        var source2 = client.executeSubscription(request, {
          ...args.context,
          ...opts
        });
        deferDispatch(setState, (state2) => [source2, state2[1], deps]);
      }, [client, request, args.context, args.pause]);
      return [currentResult, executeSubscription];
    }
    __name(useSubscription, "useSubscription");
    function Mutation(props) {
      var mutation = useMutation(props.query);
      return props.children({
        ...mutation[0],
        executeMutation: mutation[1]
      });
    }
    __name(Mutation, "Mutation");
    function Query(props) {
      var query = useQuery(props);
      return props.children({
        ...query[0],
        executeQuery: query[1]
      });
    }
    __name(Query, "Query");
    function Subscription(props) {
      var subscription = useSubscription(props, props.handler);
      return props.children({
        ...subscription[0],
        executeSubscription: subscription[1]
      });
    }
    __name(Subscription, "Subscription");
    exports.Consumer = Consumer;
    exports.Context = Context;
    exports.Mutation = Mutation;
    exports.Provider = Provider;
    exports.Query = Query;
    exports.Subscription = Subscription;
    exports.useClient = useClient;
    exports.useMutation = useMutation;
    exports.useQuery = useQuery;
    exports.useSubscription = useSubscription;
    Object.keys(core).forEach(function(k) {
      if (k !== "default" && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: /* @__PURE__ */ __name(function() {
          return core[k];
        }, "get")
      });
    });
  }
});

// node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js"(exports, module) {
    init_esm();
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var w = d * 7;
    var y = d * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "weeks":
        case "week":
        case "w":
          return n * w;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    __name(parse, "parse");
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return Math.round(ms / d) + "d";
      }
      if (msAbs >= h) {
        return Math.round(ms / h) + "h";
      }
      if (msAbs >= m) {
        return Math.round(ms / m) + "m";
      }
      if (msAbs >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    __name(fmtShort, "fmtShort");
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      if (msAbs >= d) {
        return plural(ms, msAbs, d, "day");
      }
      if (msAbs >= h) {
        return plural(ms, msAbs, h, "hour");
      }
      if (msAbs >= m) {
        return plural(ms, msAbs, m, "minute");
      }
      if (msAbs >= s) {
        return plural(ms, msAbs, s, "second");
      }
      return ms + " ms";
    }
    __name(fmtLong, "fmtLong");
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
    __name(plural, "plural");
  }
});

// node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/common.js"(exports, module) {
    init_esm();
    function setup(env) {
      createDebug2.debug = createDebug2;
      createDebug2.default = createDebug2;
      createDebug2.coerce = coerce;
      createDebug2.disable = disable;
      createDebug2.enable = enable;
      createDebug2.enabled = enabled;
      createDebug2.humanize = require_ms();
      createDebug2.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug2[key] = env[key];
      });
      createDebug2.names = [];
      createDebug2.skips = [];
      createDebug2.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug2.colors[Math.abs(hash) % createDebug2.colors.length];
      }
      __name(selectColor, "selectColor");
      createDebug2.selectColor = selectColor;
      function createDebug2(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug3(...args) {
          if (!debug3.enabled) {
            return;
          }
          const self = debug3;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms = curr - (prevTime || curr);
          self.diff = ms;
          self.prev = prevTime;
          self.curr = curr;
          prevTime = curr;
          args[0] = createDebug2.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug2.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match = formatter.call(self, val);
              args.splice(index, 1);
              index--;
            }
            return match;
          });
          createDebug2.formatArgs.call(self, args);
          const logFn = self.log || createDebug2.log;
          logFn.apply(self, args);
        }
        __name(debug3, "debug");
        debug3.namespace = namespace;
        debug3.useColors = createDebug2.useColors();
        debug3.color = createDebug2.selectColor(namespace);
        debug3.extend = extend;
        debug3.destroy = createDebug2.destroy;
        Object.defineProperty(debug3, "enabled", {
          enumerable: true,
          configurable: false,
          get: /* @__PURE__ */ __name(() => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug2.namespaces) {
              namespacesCache = createDebug2.namespaces;
              enabledCache = createDebug2.enabled(namespace);
            }
            return enabledCache;
          }, "get"),
          set: /* @__PURE__ */ __name((v) => {
            enableOverride = v;
          }, "set")
        });
        if (typeof createDebug2.init === "function") {
          createDebug2.init(debug3);
        }
        return debug3;
      }
      __name(createDebug2, "createDebug");
      function extend(namespace, delimiter) {
        const newDebug = createDebug2(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      __name(extend, "extend");
      function enable(namespaces) {
        createDebug2.save(namespaces);
        createDebug2.namespaces = namespaces;
        createDebug2.names = [];
        createDebug2.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(" ", ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug2.skips.push(ns.slice(1));
          } else {
            createDebug2.names.push(ns);
          }
        }
      }
      __name(enable, "enable");
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      __name(matchesTemplate, "matchesTemplate");
      function disable() {
        const namespaces = [
          ...createDebug2.names,
          ...createDebug2.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug2.enable("");
        return namespaces;
      }
      __name(disable, "disable");
      function enabled(name) {
        for (const skip of createDebug2.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug2.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      __name(enabled, "enabled");
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      __name(coerce, "coerce");
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      __name(destroy, "destroy");
      createDebug2.enable(createDebug2.load());
      return createDebug2;
    }
    __name(setup, "setup");
    module.exports = setup;
  }
});

// node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/browser.js"(exports, module) {
    init_esm();
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = /* @__PURE__ */ (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    __name(useColors, "useColors");
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        if (match === "%%") {
          return;
        }
        index++;
        if (match === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    __name(formatArgs, "formatArgs");
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    __name(save, "save");
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    __name(load, "load");
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    __name(localstorage, "localstorage");
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js
var require_has_flag = __commonJS({
  "node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js"(exports, module) {
    "use strict";
    init_esm();
    module.exports = (flag, argv = process.argv) => {
      const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
      const position = argv.indexOf(prefix + flag);
      const terminatorPosition = argv.indexOf("--");
      return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };
  }
});

// node_modules/.pnpm/supports-color@7.2.0/node_modules/supports-color/index.js
var require_supports_color = __commonJS({
  "node_modules/.pnpm/supports-color@7.2.0/node_modules/supports-color/index.js"(exports, module) {
    "use strict";
    init_esm();
    var os = __require("os");
    var tty = __require("tty");
    var hasFlag = require_has_flag();
    var { env } = process;
    var forceColor;
    if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
      forceColor = 0;
    } else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
      forceColor = 1;
    }
    if ("FORCE_COLOR" in env) {
      if (env.FORCE_COLOR === "true") {
        forceColor = 1;
      } else if (env.FORCE_COLOR === "false") {
        forceColor = 0;
      } else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
      }
    }
    function translateLevel(level) {
      if (level === 0) {
        return false;
      }
      return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
      };
    }
    __name(translateLevel, "translateLevel");
    function supportsColor(haveStream, streamIsTTY) {
      if (forceColor === 0) {
        return 0;
      }
      if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
        return 3;
      }
      if (hasFlag("color=256")) {
        return 2;
      }
      if (haveStream && !streamIsTTY && forceColor === void 0) {
        return 0;
      }
      const min = forceColor || 0;
      if (env.TERM === "dumb") {
        return min;
      }
      if (process.platform === "win32") {
        const osRelease = os.release().split(".");
        if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
          return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
      }
      if ("CI" in env) {
        if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
          return 1;
        }
        return min;
      }
      if ("TEAMCITY_VERSION" in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
      }
      if (env.COLORTERM === "truecolor") {
        return 3;
      }
      if ("TERM_PROGRAM" in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
        switch (env.TERM_PROGRAM) {
          case "iTerm.app":
            return version >= 3 ? 3 : 2;
          case "Apple_Terminal":
            return 2;
        }
      }
      if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
      }
      if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
      }
      if ("COLORTERM" in env) {
        return 1;
      }
      return min;
    }
    __name(supportsColor, "supportsColor");
    function getSupportLevel(stream) {
      const level = supportsColor(stream, stream && stream.isTTY);
      return translateLevel(level);
    }
    __name(getSupportLevel, "getSupportLevel");
    module.exports = {
      supportsColor: getSupportLevel,
      stdout: translateLevel(supportsColor(true, tty.isatty(1))),
      stderr: translateLevel(supportsColor(true, tty.isatty(2)))
    };
  }
});

// node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/node.js"(exports, module) {
    init_esm();
    var tty = __require("tty");
    var util = __require("util");
    exports.init = init;
    exports.log = log;
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports.colors = [6, 2, 3, 4, 5, 1];
    try {
      const supportsColor = require_supports_color();
      if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
          20,
          21,
          26,
          27,
          32,
          33,
          38,
          39,
          40,
          41,
          42,
          43,
          44,
          45,
          56,
          57,
          62,
          63,
          68,
          69,
          74,
          75,
          76,
          77,
          78,
          79,
          80,
          81,
          92,
          93,
          98,
          99,
          112,
          113,
          128,
          129,
          134,
          135,
          148,
          149,
          160,
          161,
          162,
          163,
          164,
          165,
          166,
          167,
          168,
          169,
          170,
          171,
          172,
          173,
          178,
          179,
          184,
          185,
          196,
          197,
          198,
          199,
          200,
          201,
          202,
          203,
          204,
          205,
          206,
          207,
          208,
          209,
          214,
          215,
          220,
          221
        ];
      }
    } catch (error) {
    }
    exports.inspectOpts = Object.keys(process.env).filter((key) => {
      return /^debug_/i.test(key);
    }).reduce((obj, key) => {
      const prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
      });
      let val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
      } else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
      } else if (val === "null") {
        val = null;
      } else {
        val = Number(val);
      }
      obj[prop] = val;
      return obj;
    }, {});
    function useColors() {
      return "colors" in exports.inspectOpts ? Boolean(exports.inspectOpts.colors) : tty.isatty(process.stderr.fd);
    }
    __name(useColors, "useColors");
    function formatArgs(args) {
      const { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        const c = this.color;
        const colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c);
        const prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push(colorCode + "m+" + module.exports.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = getDate() + name + " " + args[0];
      }
    }
    __name(formatArgs, "formatArgs");
    function getDate() {
      if (exports.inspectOpts.hideDate) {
        return "";
      }
      return (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    __name(getDate, "getDate");
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + "\n");
    }
    __name(log, "log");
    function save(namespaces) {
      if (namespaces) {
        process.env.DEBUG = namespaces;
      } else {
        delete process.env.DEBUG;
      }
    }
    __name(save, "save");
    function load() {
      return process.env.DEBUG;
    }
    __name(load, "load");
    function init(debug3) {
      debug3.inspectOpts = {};
      const keys = Object.keys(exports.inspectOpts);
      for (let i = 0; i < keys.length; i++) {
        debug3.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
      }
    }
    __name(init, "init");
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/.pnpm/debug@4.4.0/node_modules/debug/src/index.js"(exports, module) {
    init_esm();
    if (typeof process === "undefined" || process.type === "renderer" || process.browser === true || process.__nwjs) {
      module.exports = require_browser();
    } else {
      module.exports = require_node();
    }
  }
});

// src/lib/saleor-client.ts
init_esm();
var import_urql = __toESM(require_urql(), 1);

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/index.js
init_esm();
import http2 from "node:http";
import https from "node:https";
import zlib from "node:zlib";
import Stream2, { PassThrough as PassThrough2, pipeline as pump } from "node:stream";
import { Buffer as Buffer3 } from "node:buffer";

// node_modules/.pnpm/data-uri-to-buffer@4.0.1/node_modules/data-uri-to-buffer/dist/index.js
init_esm();
function dataUriToBuffer(uri) {
  if (!/^data:/i.test(uri)) {
    throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
  }
  uri = uri.replace(/\r?\n/g, "");
  const firstComma = uri.indexOf(",");
  if (firstComma === -1 || firstComma <= 4) {
    throw new TypeError("malformed data: URI");
  }
  const meta = uri.substring(5, firstComma).split(";");
  let charset = "";
  let base64 = false;
  const type = meta[0] || "text/plain";
  let typeFull = type;
  for (let i = 1; i < meta.length; i++) {
    if (meta[i] === "base64") {
      base64 = true;
    } else if (meta[i]) {
      typeFull += `;${meta[i]}`;
      if (meta[i].indexOf("charset=") === 0) {
        charset = meta[i].substring(8);
      }
    }
  }
  if (!meta[0] && !charset.length) {
    typeFull += ";charset=US-ASCII";
    charset = "US-ASCII";
  }
  const encoding = base64 ? "base64" : "ascii";
  const data = unescape(uri.substring(firstComma + 1));
  const buffer = Buffer.from(data, encoding);
  buffer.type = type;
  buffer.typeFull = typeFull;
  buffer.charset = charset;
  return buffer;
}
__name(dataUriToBuffer, "dataUriToBuffer");
var dist_default = dataUriToBuffer;

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/body.js
init_esm();
import Stream, { PassThrough } from "node:stream";
import { types, deprecate, promisify } from "node:util";
import { Buffer as Buffer2 } from "node:buffer";

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/errors/fetch-error.js
init_esm();

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/errors/base.js
init_esm();
var FetchBaseError = class extends Error {
  static {
    __name(this, "FetchBaseError");
  }
  constructor(message, type) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.type = type;
  }
  get name() {
    return this.constructor.name;
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
};

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/errors/fetch-error.js
var FetchError = class extends FetchBaseError {
  static {
    __name(this, "FetchError");
  }
  /**
   * @param  {string} message -      Error message for human
   * @param  {string} [type] -        Error type for machine
   * @param  {SystemError} [systemError] - For Node.js system error
   */
  constructor(message, type, systemError) {
    super(message, type);
    if (systemError) {
      this.code = this.errno = systemError.code;
      this.erroredSysCall = systemError.syscall;
    }
  }
};

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/utils/is.js
init_esm();
var NAME = Symbol.toStringTag;
var isURLSearchParameters = /* @__PURE__ */ __name((object) => {
  return typeof object === "object" && typeof object.append === "function" && typeof object.delete === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.has === "function" && typeof object.set === "function" && typeof object.sort === "function" && object[NAME] === "URLSearchParams";
}, "isURLSearchParameters");
var isBlob = /* @__PURE__ */ __name((object) => {
  return object && typeof object === "object" && typeof object.arrayBuffer === "function" && typeof object.type === "string" && typeof object.stream === "function" && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[NAME]);
}, "isBlob");
var isAbortSignal = /* @__PURE__ */ __name((object) => {
  return typeof object === "object" && (object[NAME] === "AbortSignal" || object[NAME] === "EventTarget");
}, "isAbortSignal");
var isDomainOrSubdomain = /* @__PURE__ */ __name((destination, original) => {
  const orig = new URL(original).hostname;
  const dest = new URL(destination).hostname;
  return orig === dest || orig.endsWith(`.${dest}`);
}, "isDomainOrSubdomain");
var isSameProtocol = /* @__PURE__ */ __name((destination, original) => {
  const orig = new URL(original).protocol;
  const dest = new URL(destination).protocol;
  return orig === dest;
}, "isSameProtocol");

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/body.js
var pipeline = promisify(Stream.pipeline);
var INTERNALS = Symbol("Body internals");
var Body = class {
  static {
    __name(this, "Body");
  }
  constructor(body, {
    size = 0
  } = {}) {
    let boundary = null;
    if (body === null) {
      body = null;
    } else if (isURLSearchParameters(body)) {
      body = Buffer2.from(body.toString());
    } else if (isBlob(body)) {
    } else if (Buffer2.isBuffer(body)) {
    } else if (types.isAnyArrayBuffer(body)) {
      body = Buffer2.from(body);
    } else if (ArrayBuffer.isView(body)) {
      body = Buffer2.from(body.buffer, body.byteOffset, body.byteLength);
    } else if (body instanceof Stream) {
    } else if (body instanceof FormData2) {
      body = formDataToBlob(body);
      boundary = body.type.split("=")[1];
    } else {
      body = Buffer2.from(String(body));
    }
    let stream = body;
    if (Buffer2.isBuffer(body)) {
      stream = Stream.Readable.from(body);
    } else if (isBlob(body)) {
      stream = Stream.Readable.from(body.stream());
    }
    this[INTERNALS] = {
      body,
      stream,
      boundary,
      disturbed: false,
      error: null
    };
    this.size = size;
    if (body instanceof Stream) {
      body.on("error", (error_) => {
        const error = error_ instanceof FetchBaseError ? error_ : new FetchError(`Invalid response body while trying to fetch ${this.url}: ${error_.message}`, "system", error_);
        this[INTERNALS].error = error;
      });
    }
  }
  get body() {
    return this[INTERNALS].stream;
  }
  get bodyUsed() {
    return this[INTERNALS].disturbed;
  }
  /**
   * Decode response as ArrayBuffer
   *
   * @return  Promise
   */
  async arrayBuffer() {
    const { buffer, byteOffset, byteLength } = await consumeBody(this);
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  async formData() {
    const ct = this.headers.get("content-type");
    if (ct.startsWith("application/x-www-form-urlencoded")) {
      const formData = new FormData2();
      const parameters = new URLSearchParams(await this.text());
      for (const [name, value] of parameters) {
        formData.append(name, value);
      }
      return formData;
    }
    const { toFormData } = await import("./multipart-parser-JPWL25WA.mjs");
    return toFormData(this.body, ct);
  }
  /**
   * Return raw response as Blob
   *
   * @return Promise
   */
  async blob() {
    const ct = this.headers && this.headers.get("content-type") || this[INTERNALS].body && this[INTERNALS].body.type || "";
    const buf = await this.arrayBuffer();
    return new fetch_blob_default([buf], {
      type: ct
    });
  }
  /**
   * Decode response as json
   *
   * @return  Promise
   */
  async json() {
    const text = await this.text();
    return JSON.parse(text);
  }
  /**
   * Decode response as text
   *
   * @return  Promise
   */
  async text() {
    const buffer = await consumeBody(this);
    return new TextDecoder().decode(buffer);
  }
  /**
   * Decode response as buffer (non-spec api)
   *
   * @return  Promise
   */
  buffer() {
    return consumeBody(this);
  }
};
Body.prototype.buffer = deprecate(Body.prototype.buffer, "Please use 'response.arrayBuffer()' instead of 'response.buffer()'", "node-fetch#buffer");
Object.defineProperties(Body.prototype, {
  body: { enumerable: true },
  bodyUsed: { enumerable: true },
  arrayBuffer: { enumerable: true },
  blob: { enumerable: true },
  json: { enumerable: true },
  text: { enumerable: true },
  data: { get: deprecate(
    () => {
    },
    "data doesn't exist, use json(), text(), arrayBuffer(), or body instead",
    "https://github.com/node-fetch/node-fetch/issues/1000 (response)"
  ) }
});
async function consumeBody(data) {
  if (data[INTERNALS].disturbed) {
    throw new TypeError(`body used already for: ${data.url}`);
  }
  data[INTERNALS].disturbed = true;
  if (data[INTERNALS].error) {
    throw data[INTERNALS].error;
  }
  const { body } = data;
  if (body === null) {
    return Buffer2.alloc(0);
  }
  if (!(body instanceof Stream)) {
    return Buffer2.alloc(0);
  }
  const accum = [];
  let accumBytes = 0;
  try {
    for await (const chunk of body) {
      if (data.size > 0 && accumBytes + chunk.length > data.size) {
        const error = new FetchError(`content size at ${data.url} over limit: ${data.size}`, "max-size");
        body.destroy(error);
        throw error;
      }
      accumBytes += chunk.length;
      accum.push(chunk);
    }
  } catch (error) {
    const error_ = error instanceof FetchBaseError ? error : new FetchError(`Invalid response body while trying to fetch ${data.url}: ${error.message}`, "system", error);
    throw error_;
  }
  if (body.readableEnded === true || body._readableState.ended === true) {
    try {
      if (accum.every((c) => typeof c === "string")) {
        return Buffer2.from(accum.join(""));
      }
      return Buffer2.concat(accum, accumBytes);
    } catch (error) {
      throw new FetchError(`Could not create Buffer from response body for ${data.url}: ${error.message}`, "system", error);
    }
  } else {
    throw new FetchError(`Premature close of server response while trying to fetch ${data.url}`);
  }
}
__name(consumeBody, "consumeBody");
var clone = /* @__PURE__ */ __name((instance, highWaterMark) => {
  let p1;
  let p2;
  let { body } = instance[INTERNALS];
  if (instance.bodyUsed) {
    throw new Error("cannot clone body after it is used");
  }
  if (body instanceof Stream && typeof body.getBoundary !== "function") {
    p1 = new PassThrough({ highWaterMark });
    p2 = new PassThrough({ highWaterMark });
    body.pipe(p1);
    body.pipe(p2);
    instance[INTERNALS].stream = p1;
    body = p2;
  }
  return body;
}, "clone");
var getNonSpecFormDataBoundary = deprecate(
  (body) => body.getBoundary(),
  "form-data doesn't follow the spec and requires special treatment. Use alternative package",
  "https://github.com/node-fetch/node-fetch/issues/1167"
);
var extractContentType = /* @__PURE__ */ __name((body, request) => {
  if (body === null) {
    return null;
  }
  if (typeof body === "string") {
    return "text/plain;charset=UTF-8";
  }
  if (isURLSearchParameters(body)) {
    return "application/x-www-form-urlencoded;charset=UTF-8";
  }
  if (isBlob(body)) {
    return body.type || null;
  }
  if (Buffer2.isBuffer(body) || types.isAnyArrayBuffer(body) || ArrayBuffer.isView(body)) {
    return null;
  }
  if (body instanceof FormData2) {
    return `multipart/form-data; boundary=${request[INTERNALS].boundary}`;
  }
  if (body && typeof body.getBoundary === "function") {
    return `multipart/form-data;boundary=${getNonSpecFormDataBoundary(body)}`;
  }
  if (body instanceof Stream) {
    return null;
  }
  return "text/plain;charset=UTF-8";
}, "extractContentType");
var getTotalBytes = /* @__PURE__ */ __name((request) => {
  const { body } = request[INTERNALS];
  if (body === null) {
    return 0;
  }
  if (isBlob(body)) {
    return body.size;
  }
  if (Buffer2.isBuffer(body)) {
    return body.length;
  }
  if (body && typeof body.getLengthSync === "function") {
    return body.hasKnownLength && body.hasKnownLength() ? body.getLengthSync() : null;
  }
  return null;
}, "getTotalBytes");
var writeToStream = /* @__PURE__ */ __name(async (dest, { body }) => {
  if (body === null) {
    dest.end();
  } else {
    await pipeline(body, dest);
  }
}, "writeToStream");

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/response.js
init_esm();

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/headers.js
init_esm();
import { types as types2 } from "node:util";
import http from "node:http";
var validateHeaderName = typeof http.validateHeaderName === "function" ? http.validateHeaderName : (name) => {
  if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name)) {
    const error = new TypeError(`Header name must be a valid HTTP token [${name}]`);
    Object.defineProperty(error, "code", { value: "ERR_INVALID_HTTP_TOKEN" });
    throw error;
  }
};
var validateHeaderValue = typeof http.validateHeaderValue === "function" ? http.validateHeaderValue : (name, value) => {
  if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
    const error = new TypeError(`Invalid character in header content ["${name}"]`);
    Object.defineProperty(error, "code", { value: "ERR_INVALID_CHAR" });
    throw error;
  }
};
var Headers = class _Headers extends URLSearchParams {
  static {
    __name(this, "Headers");
  }
  /**
   * Headers class
   *
   * @constructor
   * @param {HeadersInit} [init] - Response headers
   */
  constructor(init) {
    let result = [];
    if (init instanceof _Headers) {
      const raw = init.raw();
      for (const [name, values] of Object.entries(raw)) {
        result.push(...values.map((value) => [name, value]));
      }
    } else if (init == null) {
    } else if (typeof init === "object" && !types2.isBoxedPrimitive(init)) {
      const method = init[Symbol.iterator];
      if (method == null) {
        result.push(...Object.entries(init));
      } else {
        if (typeof method !== "function") {
          throw new TypeError("Header pairs must be iterable");
        }
        result = [...init].map((pair) => {
          if (typeof pair !== "object" || types2.isBoxedPrimitive(pair)) {
            throw new TypeError("Each header pair must be an iterable object");
          }
          return [...pair];
        }).map((pair) => {
          if (pair.length !== 2) {
            throw new TypeError("Each header pair must be a name/value tuple");
          }
          return [...pair];
        });
      }
    } else {
      throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");
    }
    result = result.length > 0 ? result.map(([name, value]) => {
      validateHeaderName(name);
      validateHeaderValue(name, String(value));
      return [String(name).toLowerCase(), String(value)];
    }) : void 0;
    super(result);
    return new Proxy(this, {
      get(target, p, receiver) {
        switch (p) {
          case "append":
          case "set":
            return (name, value) => {
              validateHeaderName(name);
              validateHeaderValue(name, String(value));
              return URLSearchParams.prototype[p].call(
                target,
                String(name).toLowerCase(),
                String(value)
              );
            };
          case "delete":
          case "has":
          case "getAll":
            return (name) => {
              validateHeaderName(name);
              return URLSearchParams.prototype[p].call(
                target,
                String(name).toLowerCase()
              );
            };
          case "keys":
            return () => {
              target.sort();
              return new Set(URLSearchParams.prototype.keys.call(target)).keys();
            };
          default:
            return Reflect.get(target, p, receiver);
        }
      }
    });
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
  toString() {
    return Object.prototype.toString.call(this);
  }
  get(name) {
    const values = this.getAll(name);
    if (values.length === 0) {
      return null;
    }
    let value = values.join(", ");
    if (/^content-encoding$/i.test(name)) {
      value = value.toLowerCase();
    }
    return value;
  }
  forEach(callback, thisArg = void 0) {
    for (const name of this.keys()) {
      Reflect.apply(callback, thisArg, [this.get(name), name, this]);
    }
  }
  *values() {
    for (const name of this.keys()) {
      yield this.get(name);
    }
  }
  /**
   * @type {() => IterableIterator<[string, string]>}
   */
  *entries() {
    for (const name of this.keys()) {
      yield [name, this.get(name)];
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  /**
   * Node-fetch non-spec method
   * returning all headers and their values as array
   * @returns {Record<string, string[]>}
   */
  raw() {
    return [...this.keys()].reduce((result, key) => {
      result[key] = this.getAll(key);
      return result;
    }, {});
  }
  /**
   * For better console.log(headers) and also to convert Headers into Node.js Request compatible format
   */
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return [...this.keys()].reduce((result, key) => {
      const values = this.getAll(key);
      if (key === "host") {
        result[key] = values[0];
      } else {
        result[key] = values.length > 1 ? values : values[0];
      }
      return result;
    }, {});
  }
};
Object.defineProperties(
  Headers.prototype,
  ["get", "entries", "forEach", "values"].reduce((result, property) => {
    result[property] = { enumerable: true };
    return result;
  }, {})
);
function fromRawHeaders(headers = []) {
  return new Headers(
    headers.reduce((result, value, index, array) => {
      if (index % 2 === 0) {
        result.push(array.slice(index, index + 2));
      }
      return result;
    }, []).filter(([name, value]) => {
      try {
        validateHeaderName(name);
        validateHeaderValue(name, String(value));
        return true;
      } catch {
        return false;
      }
    })
  );
}
__name(fromRawHeaders, "fromRawHeaders");

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/utils/is-redirect.js
init_esm();
var redirectStatus = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
var isRedirect = /* @__PURE__ */ __name((code) => {
  return redirectStatus.has(code);
}, "isRedirect");

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/response.js
var INTERNALS2 = Symbol("Response internals");
var Response = class _Response extends Body {
  static {
    __name(this, "Response");
  }
  constructor(body = null, options = {}) {
    super(body, options);
    const status = options.status != null ? options.status : 200;
    const headers = new Headers(options.headers);
    if (body !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(body, this);
      if (contentType) {
        headers.append("Content-Type", contentType);
      }
    }
    this[INTERNALS2] = {
      type: "default",
      url: options.url,
      status,
      statusText: options.statusText || "",
      headers,
      counter: options.counter,
      highWaterMark: options.highWaterMark
    };
  }
  get type() {
    return this[INTERNALS2].type;
  }
  get url() {
    return this[INTERNALS2].url || "";
  }
  get status() {
    return this[INTERNALS2].status;
  }
  /**
   * Convenience property representing if the request ended normally
   */
  get ok() {
    return this[INTERNALS2].status >= 200 && this[INTERNALS2].status < 300;
  }
  get redirected() {
    return this[INTERNALS2].counter > 0;
  }
  get statusText() {
    return this[INTERNALS2].statusText;
  }
  get headers() {
    return this[INTERNALS2].headers;
  }
  get highWaterMark() {
    return this[INTERNALS2].highWaterMark;
  }
  /**
   * Clone this response
   *
   * @return  Response
   */
  clone() {
    return new _Response(clone(this, this.highWaterMark), {
      type: this.type,
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      ok: this.ok,
      redirected: this.redirected,
      size: this.size,
      highWaterMark: this.highWaterMark
    });
  }
  /**
   * @param {string} url    The URL that the new response is to originate from.
   * @param {number} status An optional status code for the response (e.g., 302.)
   * @returns {Response}    A Response object.
   */
  static redirect(url, status = 302) {
    if (!isRedirect(status)) {
      throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
    }
    return new _Response(null, {
      headers: {
        location: new URL(url).toString()
      },
      status
    });
  }
  static error() {
    const response = new _Response(null, { status: 0, statusText: "" });
    response[INTERNALS2].type = "error";
    return response;
  }
  static json(data = void 0, init = {}) {
    const body = JSON.stringify(data);
    if (body === void 0) {
      throw new TypeError("data is not JSON serializable");
    }
    const headers = new Headers(init && init.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return new _Response(body, {
      ...init,
      headers
    });
  }
  get [Symbol.toStringTag]() {
    return "Response";
  }
};
Object.defineProperties(Response.prototype, {
  type: { enumerable: true },
  url: { enumerable: true },
  status: { enumerable: true },
  ok: { enumerable: true },
  redirected: { enumerable: true },
  statusText: { enumerable: true },
  headers: { enumerable: true },
  clone: { enumerable: true }
});

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/request.js
init_esm();
import { format as formatUrl } from "node:url";
import { deprecate as deprecate2 } from "node:util";

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/utils/get-search.js
init_esm();
var getSearch = /* @__PURE__ */ __name((parsedURL) => {
  if (parsedURL.search) {
    return parsedURL.search;
  }
  const lastOffset = parsedURL.href.length - 1;
  const hash = parsedURL.hash || (parsedURL.href[lastOffset] === "#" ? "#" : "");
  return parsedURL.href[lastOffset - hash.length] === "?" ? "?" : "";
}, "getSearch");

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/utils/referrer.js
init_esm();
import { isIP } from "node:net";
function stripURLForUseAsAReferrer(url, originOnly = false) {
  if (url == null) {
    return "no-referrer";
  }
  url = new URL(url);
  if (/^(about|blob|data):$/.test(url.protocol)) {
    return "no-referrer";
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  if (originOnly) {
    url.pathname = "";
    url.search = "";
  }
  return url;
}
__name(stripURLForUseAsAReferrer, "stripURLForUseAsAReferrer");
var ReferrerPolicy = /* @__PURE__ */ new Set([
  "",
  "no-referrer",
  "no-referrer-when-downgrade",
  "same-origin",
  "origin",
  "strict-origin",
  "origin-when-cross-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url"
]);
var DEFAULT_REFERRER_POLICY = "strict-origin-when-cross-origin";
function validateReferrerPolicy(referrerPolicy) {
  if (!ReferrerPolicy.has(referrerPolicy)) {
    throw new TypeError(`Invalid referrerPolicy: ${referrerPolicy}`);
  }
  return referrerPolicy;
}
__name(validateReferrerPolicy, "validateReferrerPolicy");
function isOriginPotentiallyTrustworthy(url) {
  if (/^(http|ws)s:$/.test(url.protocol)) {
    return true;
  }
  const hostIp = url.host.replace(/(^\[)|(]$)/g, "");
  const hostIPVersion = isIP(hostIp);
  if (hostIPVersion === 4 && /^127\./.test(hostIp)) {
    return true;
  }
  if (hostIPVersion === 6 && /^(((0+:){7})|(::(0+:){0,6}))0*1$/.test(hostIp)) {
    return true;
  }
  if (url.host === "localhost" || url.host.endsWith(".localhost")) {
    return false;
  }
  if (url.protocol === "file:") {
    return true;
  }
  return false;
}
__name(isOriginPotentiallyTrustworthy, "isOriginPotentiallyTrustworthy");
function isUrlPotentiallyTrustworthy(url) {
  if (/^about:(blank|srcdoc)$/.test(url)) {
    return true;
  }
  if (url.protocol === "data:") {
    return true;
  }
  if (/^(blob|filesystem):$/.test(url.protocol)) {
    return true;
  }
  return isOriginPotentiallyTrustworthy(url);
}
__name(isUrlPotentiallyTrustworthy, "isUrlPotentiallyTrustworthy");
function determineRequestsReferrer(request, { referrerURLCallback, referrerOriginCallback } = {}) {
  if (request.referrer === "no-referrer" || request.referrerPolicy === "") {
    return null;
  }
  const policy = request.referrerPolicy;
  if (request.referrer === "about:client") {
    return "no-referrer";
  }
  const referrerSource = request.referrer;
  let referrerURL = stripURLForUseAsAReferrer(referrerSource);
  let referrerOrigin = stripURLForUseAsAReferrer(referrerSource, true);
  if (referrerURL.toString().length > 4096) {
    referrerURL = referrerOrigin;
  }
  if (referrerURLCallback) {
    referrerURL = referrerURLCallback(referrerURL);
  }
  if (referrerOriginCallback) {
    referrerOrigin = referrerOriginCallback(referrerOrigin);
  }
  const currentURL = new URL(request.url);
  switch (policy) {
    case "no-referrer":
      return "no-referrer";
    case "origin":
      return referrerOrigin;
    case "unsafe-url":
      return referrerURL;
    case "strict-origin":
      if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
        return "no-referrer";
      }
      return referrerOrigin.toString();
    case "strict-origin-when-cross-origin":
      if (referrerURL.origin === currentURL.origin) {
        return referrerURL;
      }
      if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
        return "no-referrer";
      }
      return referrerOrigin;
    case "same-origin":
      if (referrerURL.origin === currentURL.origin) {
        return referrerURL;
      }
      return "no-referrer";
    case "origin-when-cross-origin":
      if (referrerURL.origin === currentURL.origin) {
        return referrerURL;
      }
      return referrerOrigin;
    case "no-referrer-when-downgrade":
      if (isUrlPotentiallyTrustworthy(referrerURL) && !isUrlPotentiallyTrustworthy(currentURL)) {
        return "no-referrer";
      }
      return referrerURL;
    default:
      throw new TypeError(`Invalid referrerPolicy: ${policy}`);
  }
}
__name(determineRequestsReferrer, "determineRequestsReferrer");
function parseReferrerPolicyFromHeader(headers) {
  const policyTokens = (headers.get("referrer-policy") || "").split(/[,\s]+/);
  let policy = "";
  for (const token of policyTokens) {
    if (token && ReferrerPolicy.has(token)) {
      policy = token;
    }
  }
  return policy;
}
__name(parseReferrerPolicyFromHeader, "parseReferrerPolicyFromHeader");

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/request.js
var INTERNALS3 = Symbol("Request internals");
var isRequest = /* @__PURE__ */ __name((object) => {
  return typeof object === "object" && typeof object[INTERNALS3] === "object";
}, "isRequest");
var doBadDataWarn = deprecate2(
  () => {
  },
  ".data is not a valid RequestInit property, use .body instead",
  "https://github.com/node-fetch/node-fetch/issues/1000 (request)"
);
var Request = class _Request extends Body {
  static {
    __name(this, "Request");
  }
  constructor(input, init = {}) {
    let parsedURL;
    if (isRequest(input)) {
      parsedURL = new URL(input.url);
    } else {
      parsedURL = new URL(input);
      input = {};
    }
    if (parsedURL.username !== "" || parsedURL.password !== "") {
      throw new TypeError(`${parsedURL} is an url with embedded credentials.`);
    }
    let method = init.method || input.method || "GET";
    if (/^(delete|get|head|options|post|put)$/i.test(method)) {
      method = method.toUpperCase();
    }
    if (!isRequest(init) && "data" in init) {
      doBadDataWarn();
    }
    if ((init.body != null || isRequest(input) && input.body !== null) && (method === "GET" || method === "HEAD")) {
      throw new TypeError("Request with GET/HEAD method cannot have body");
    }
    const inputBody = init.body ? init.body : isRequest(input) && input.body !== null ? clone(input) : null;
    super(inputBody, {
      size: init.size || input.size || 0
    });
    const headers = new Headers(init.headers || input.headers || {});
    if (inputBody !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(inputBody, this);
      if (contentType) {
        headers.set("Content-Type", contentType);
      }
    }
    let signal = isRequest(input) ? input.signal : null;
    if ("signal" in init) {
      signal = init.signal;
    }
    if (signal != null && !isAbortSignal(signal)) {
      throw new TypeError("Expected signal to be an instanceof AbortSignal or EventTarget");
    }
    let referrer = init.referrer == null ? input.referrer : init.referrer;
    if (referrer === "") {
      referrer = "no-referrer";
    } else if (referrer) {
      const parsedReferrer = new URL(referrer);
      referrer = /^about:(\/\/)?client$/.test(parsedReferrer) ? "client" : parsedReferrer;
    } else {
      referrer = void 0;
    }
    this[INTERNALS3] = {
      method,
      redirect: init.redirect || input.redirect || "follow",
      headers,
      parsedURL,
      signal,
      referrer
    };
    this.follow = init.follow === void 0 ? input.follow === void 0 ? 20 : input.follow : init.follow;
    this.compress = init.compress === void 0 ? input.compress === void 0 ? true : input.compress : init.compress;
    this.counter = init.counter || input.counter || 0;
    this.agent = init.agent || input.agent;
    this.highWaterMark = init.highWaterMark || input.highWaterMark || 16384;
    this.insecureHTTPParser = init.insecureHTTPParser || input.insecureHTTPParser || false;
    this.referrerPolicy = init.referrerPolicy || input.referrerPolicy || "";
  }
  /** @returns {string} */
  get method() {
    return this[INTERNALS3].method;
  }
  /** @returns {string} */
  get url() {
    return formatUrl(this[INTERNALS3].parsedURL);
  }
  /** @returns {Headers} */
  get headers() {
    return this[INTERNALS3].headers;
  }
  get redirect() {
    return this[INTERNALS3].redirect;
  }
  /** @returns {AbortSignal} */
  get signal() {
    return this[INTERNALS3].signal;
  }
  // https://fetch.spec.whatwg.org/#dom-request-referrer
  get referrer() {
    if (this[INTERNALS3].referrer === "no-referrer") {
      return "";
    }
    if (this[INTERNALS3].referrer === "client") {
      return "about:client";
    }
    if (this[INTERNALS3].referrer) {
      return this[INTERNALS3].referrer.toString();
    }
    return void 0;
  }
  get referrerPolicy() {
    return this[INTERNALS3].referrerPolicy;
  }
  set referrerPolicy(referrerPolicy) {
    this[INTERNALS3].referrerPolicy = validateReferrerPolicy(referrerPolicy);
  }
  /**
   * Clone this request
   *
   * @return  Request
   */
  clone() {
    return new _Request(this);
  }
  get [Symbol.toStringTag]() {
    return "Request";
  }
};
Object.defineProperties(Request.prototype, {
  method: { enumerable: true },
  url: { enumerable: true },
  headers: { enumerable: true },
  redirect: { enumerable: true },
  clone: { enumerable: true },
  signal: { enumerable: true },
  referrer: { enumerable: true },
  referrerPolicy: { enumerable: true }
});
var getNodeRequestOptions = /* @__PURE__ */ __name((request) => {
  const { parsedURL } = request[INTERNALS3];
  const headers = new Headers(request[INTERNALS3].headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "*/*");
  }
  let contentLengthValue = null;
  if (request.body === null && /^(post|put)$/i.test(request.method)) {
    contentLengthValue = "0";
  }
  if (request.body !== null) {
    const totalBytes = getTotalBytes(request);
    if (typeof totalBytes === "number" && !Number.isNaN(totalBytes)) {
      contentLengthValue = String(totalBytes);
    }
  }
  if (contentLengthValue) {
    headers.set("Content-Length", contentLengthValue);
  }
  if (request.referrerPolicy === "") {
    request.referrerPolicy = DEFAULT_REFERRER_POLICY;
  }
  if (request.referrer && request.referrer !== "no-referrer") {
    request[INTERNALS3].referrer = determineRequestsReferrer(request);
  } else {
    request[INTERNALS3].referrer = "no-referrer";
  }
  if (request[INTERNALS3].referrer instanceof URL) {
    headers.set("Referer", request.referrer);
  }
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "node-fetch");
  }
  if (request.compress && !headers.has("Accept-Encoding")) {
    headers.set("Accept-Encoding", "gzip, deflate, br");
  }
  let { agent } = request;
  if (typeof agent === "function") {
    agent = agent(parsedURL);
  }
  const search = getSearch(parsedURL);
  const options = {
    // Overwrite search to retain trailing ? (issue #776)
    path: parsedURL.pathname + search,
    // The following options are not expressed in the URL
    method: request.method,
    headers: headers[Symbol.for("nodejs.util.inspect.custom")](),
    insecureHTTPParser: request.insecureHTTPParser,
    agent
  };
  return {
    /** @type {URL} */
    parsedURL,
    options
  };
}, "getNodeRequestOptions");

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/errors/abort-error.js
init_esm();
var AbortError = class extends FetchBaseError {
  static {
    __name(this, "AbortError");
  }
  constructor(message, type = "aborted") {
    super(message, type);
  }
};

// node_modules/.pnpm/node-fetch@3.3.2/node_modules/node-fetch/src/index.js
var supportedSchemas = /* @__PURE__ */ new Set(["data:", "http:", "https:"]);
async function fetch2(url, options_) {
  return new Promise((resolve, reject) => {
    const request = new Request(url, options_);
    const { parsedURL, options } = getNodeRequestOptions(request);
    if (!supportedSchemas.has(parsedURL.protocol)) {
      throw new TypeError(`node-fetch cannot load ${url}. URL scheme "${parsedURL.protocol.replace(/:$/, "")}" is not supported.`);
    }
    if (parsedURL.protocol === "data:") {
      const data = dist_default(request.url);
      const response2 = new Response(data, { headers: { "Content-Type": data.typeFull } });
      resolve(response2);
      return;
    }
    const send = (parsedURL.protocol === "https:" ? https : http2).request;
    const { signal } = request;
    let response = null;
    const abort = /* @__PURE__ */ __name(() => {
      const error = new AbortError("The operation was aborted.");
      reject(error);
      if (request.body && request.body instanceof Stream2.Readable) {
        request.body.destroy(error);
      }
      if (!response || !response.body) {
        return;
      }
      response.body.emit("error", error);
    }, "abort");
    if (signal && signal.aborted) {
      abort();
      return;
    }
    const abortAndFinalize = /* @__PURE__ */ __name(() => {
      abort();
      finalize();
    }, "abortAndFinalize");
    const request_ = send(parsedURL.toString(), options);
    if (signal) {
      signal.addEventListener("abort", abortAndFinalize);
    }
    const finalize = /* @__PURE__ */ __name(() => {
      request_.abort();
      if (signal) {
        signal.removeEventListener("abort", abortAndFinalize);
      }
    }, "finalize");
    request_.on("error", (error) => {
      reject(new FetchError(`request to ${request.url} failed, reason: ${error.message}`, "system", error));
      finalize();
    });
    fixResponseChunkedTransferBadEnding(request_, (error) => {
      if (response && response.body) {
        response.body.destroy(error);
      }
    });
    if (process.version < "v14") {
      request_.on("socket", (s) => {
        let endedWithEventsCount;
        s.prependListener("end", () => {
          endedWithEventsCount = s._eventsCount;
        });
        s.prependListener("close", (hadError) => {
          if (response && endedWithEventsCount < s._eventsCount && !hadError) {
            const error = new Error("Premature close");
            error.code = "ERR_STREAM_PREMATURE_CLOSE";
            response.body.emit("error", error);
          }
        });
      });
    }
    request_.on("response", (response_) => {
      request_.setTimeout(0);
      const headers = fromRawHeaders(response_.rawHeaders);
      if (isRedirect(response_.statusCode)) {
        const location = headers.get("Location");
        let locationURL = null;
        try {
          locationURL = location === null ? null : new URL(location, request.url);
        } catch {
          if (request.redirect !== "manual") {
            reject(new FetchError(`uri requested responds with an invalid redirect URL: ${location}`, "invalid-redirect"));
            finalize();
            return;
          }
        }
        switch (request.redirect) {
          case "error":
            reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, "no-redirect"));
            finalize();
            return;
          case "manual":
            break;
          case "follow": {
            if (locationURL === null) {
              break;
            }
            if (request.counter >= request.follow) {
              reject(new FetchError(`maximum redirect reached at: ${request.url}`, "max-redirect"));
              finalize();
              return;
            }
            const requestOptions = {
              headers: new Headers(request.headers),
              follow: request.follow,
              counter: request.counter + 1,
              agent: request.agent,
              compress: request.compress,
              method: request.method,
              body: clone(request),
              signal: request.signal,
              size: request.size,
              referrer: request.referrer,
              referrerPolicy: request.referrerPolicy
            };
            if (!isDomainOrSubdomain(request.url, locationURL) || !isSameProtocol(request.url, locationURL)) {
              for (const name of ["authorization", "www-authenticate", "cookie", "cookie2"]) {
                requestOptions.headers.delete(name);
              }
            }
            if (response_.statusCode !== 303 && request.body && options_.body instanceof Stream2.Readable) {
              reject(new FetchError("Cannot follow redirect with body being a readable stream", "unsupported-redirect"));
              finalize();
              return;
            }
            if (response_.statusCode === 303 || (response_.statusCode === 301 || response_.statusCode === 302) && request.method === "POST") {
              requestOptions.method = "GET";
              requestOptions.body = void 0;
              requestOptions.headers.delete("content-length");
            }
            const responseReferrerPolicy = parseReferrerPolicyFromHeader(headers);
            if (responseReferrerPolicy) {
              requestOptions.referrerPolicy = responseReferrerPolicy;
            }
            resolve(fetch2(new Request(locationURL, requestOptions)));
            finalize();
            return;
          }
          default:
            return reject(new TypeError(`Redirect option '${request.redirect}' is not a valid value of RequestRedirect`));
        }
      }
      if (signal) {
        response_.once("end", () => {
          signal.removeEventListener("abort", abortAndFinalize);
        });
      }
      let body = pump(response_, new PassThrough2(), (error) => {
        if (error) {
          reject(error);
        }
      });
      if (process.version < "v12.10") {
        response_.on("aborted", abortAndFinalize);
      }
      const responseOptions = {
        url: request.url,
        status: response_.statusCode,
        statusText: response_.statusMessage,
        headers,
        size: request.size,
        counter: request.counter,
        highWaterMark: request.highWaterMark
      };
      const codings = headers.get("Content-Encoding");
      if (!request.compress || request.method === "HEAD" || codings === null || response_.statusCode === 204 || response_.statusCode === 304) {
        response = new Response(body, responseOptions);
        resolve(response);
        return;
      }
      const zlibOptions = {
        flush: zlib.Z_SYNC_FLUSH,
        finishFlush: zlib.Z_SYNC_FLUSH
      };
      if (codings === "gzip" || codings === "x-gzip") {
        body = pump(body, zlib.createGunzip(zlibOptions), (error) => {
          if (error) {
            reject(error);
          }
        });
        response = new Response(body, responseOptions);
        resolve(response);
        return;
      }
      if (codings === "deflate" || codings === "x-deflate") {
        const raw = pump(response_, new PassThrough2(), (error) => {
          if (error) {
            reject(error);
          }
        });
        raw.once("data", (chunk) => {
          if ((chunk[0] & 15) === 8) {
            body = pump(body, zlib.createInflate(), (error) => {
              if (error) {
                reject(error);
              }
            });
          } else {
            body = pump(body, zlib.createInflateRaw(), (error) => {
              if (error) {
                reject(error);
              }
            });
          }
          response = new Response(body, responseOptions);
          resolve(response);
        });
        raw.once("end", () => {
          if (!response) {
            response = new Response(body, responseOptions);
            resolve(response);
          }
        });
        return;
      }
      if (codings === "br") {
        body = pump(body, zlib.createBrotliDecompress(), (error) => {
          if (error) {
            reject(error);
          }
        });
        response = new Response(body, responseOptions);
        resolve(response);
        return;
      }
      response = new Response(body, responseOptions);
      resolve(response);
    });
    writeToStream(request_, request).catch(reject);
  });
}
__name(fetch2, "fetch");
function fixResponseChunkedTransferBadEnding(request, errorCallback) {
  const LAST_CHUNK = Buffer3.from("0\r\n\r\n");
  let isChunkedTransfer = false;
  let properLastChunkReceived = false;
  let previousChunk;
  request.on("response", (response) => {
    const { headers } = response;
    isChunkedTransfer = headers["transfer-encoding"] === "chunked" && !headers["content-length"];
  });
  request.on("socket", (socket) => {
    const onSocketClose = /* @__PURE__ */ __name(() => {
      if (isChunkedTransfer && !properLastChunkReceived) {
        const error = new Error("Premature close");
        error.code = "ERR_STREAM_PREMATURE_CLOSE";
        errorCallback(error);
      }
    }, "onSocketClose");
    const onData = /* @__PURE__ */ __name((buf) => {
      properLastChunkReceived = Buffer3.compare(buf.slice(-5), LAST_CHUNK) === 0;
      if (!properLastChunkReceived && previousChunk) {
        properLastChunkReceived = Buffer3.compare(previousChunk.slice(-3), LAST_CHUNK.slice(0, 3)) === 0 && Buffer3.compare(buf.slice(-2), LAST_CHUNK.slice(3)) === 0;
      }
      previousChunk = buf;
    }, "onData");
    socket.prependListener("close", onSocketClose);
    socket.on("data", onData);
    request.on("close", () => {
      socket.removeListener("close", onSocketClose);
      socket.removeListener("data", onData);
    });
  });
}
__name(fixResponseChunkedTransferBadEnding, "fixResponseChunkedTransferBadEnding");

// src/lib/saleor-client.ts
var SALEOR_API_URL = process.env.SALEOR_API_URL || "https://example.com/graphql";
var rawToken = process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "";
var SALEOR_TOKEN = rawToken.replace(/^Bearer\s+/i, "");
if ((!SALEOR_API_URL || SALEOR_API_URL === "https://example.com/graphql") && process.env.NODE_ENV !== "production") {
}
var saleorClient = (0, import_urql.createClient)({
  url: SALEOR_API_URL,
  fetch: fetch2,
  exchanges: [import_urql.cacheExchange, import_urql.fetchExchange],
  fetchOptions: /* @__PURE__ */ __name(() => ({
    headers: {
      Authorization: `Bearer ${SALEOR_TOKEN}`
    }
  }), "fetchOptions")
});
function makeSaleorClient(url, token) {
  return (0, import_urql.createClient)({
    url,
    fetch: fetch2,
    exchanges: [import_urql.cacheExchange, import_urql.fetchExchange],
    fetchOptions: /* @__PURE__ */ __name(() => ({
      headers: {
        Authorization: `Bearer ${token}`
      }
    }), "fetchOptions")
  });
}
__name(makeSaleorClient, "makeSaleorClient");
var ORDER_QUERY = `
query GetOrderDetails($id: ID!) {
  order(id: $id) {
    id
    number
    externalReference
    userEmail
    metadata { key value }
    shippingAddress {
      firstName lastName companyName streetAddress1 streetAddress2
      city postalCode country { code } countryArea phone
    }
    lines {
      id
      productName
      quantity
      variant {
        id
        sku
        externalReference
        weight { value unit }
        product {
          name
          attributes {
            attribute { slug }
            values { name }
          }
        }
      }
      allocations {
        quantity
        warehouse { id }
      }
    }
    shippingMethod {
      id
      name
    }
  }
}
`;
var WAREHOUSE_QUERY = `
query FindWarehouse($search: String!) {
  warehouses(filter: { search: $search }, first: 1) {
    edges {
      node {
        id
        name
        address {
          firstName lastName companyName streetAddress1 streetAddress2
          city postalCode country { code } countryArea phone
        }
      }
    }
  }
}
`;
var FULFILLMENT_CREATE = `
mutation FulfillmentCreate($order: ID!, $input: OrderFulfillInput!) {
  orderFulfill(order: $order, input: $input) {
    fulfillments { id status trackingNumber }
    errors { field message }
  }
}
`;
var UPDATE_ORDER_METADATA = `
mutation UpdateOrderMeta($id: ID!, $input: [MetadataInput!]!) {
  updateMetadata(id: $id, input: $input) {
    errors { field message }
  }
}
`;

// src/saleor-app.ts
init_esm();

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/saleor-app.mjs
init_esm();
var SaleorApp = class {
  static {
    __name(this, "SaleorApp");
  }
  constructor(options) {
    this.apl = options.apl;
  }
};

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/APL/file/index.mjs
init_esm();

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/chunk-ORQVZRNL.mjs
init_esm();

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/chunk-CPDLIPGD.mjs
init_esm();
var import_debug = __toESM(require_src(), 1);
var createDebug = /* @__PURE__ */ __name((namespace) => import_debug.default.debug(`app-sdk:${namespace}`), "createDebug");

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/chunk-ORQVZRNL.mjs
var createAPLDebug = /* @__PURE__ */ __name((namespace) => createDebug(`APL:${namespace}`), "createAPLDebug");

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/APL/file/index.mjs
import { promises as fsPromises } from "fs";
var debug = createAPLDebug("FileAPL");
var FileAPL = class {
  static {
    __name(this, "FileAPL");
  }
  constructor(config = {}) {
    this.fileName = config?.fileName || ".saleor-app-auth.json";
  }
  /**
   * Load auth data from a file and return it as AuthData format.
   * In case of incomplete or invalid data, return `undefined`.
   */
  async loadDataFromFile() {
    debug(`Will try to load auth data from the ${this.fileName} file`);
    let parsedData = {};
    try {
      parsedData = JSON.parse(await fsPromises.readFile(this.fileName, "utf-8"));
      debug("%s read successfully", this.fileName);
    } catch (err) {
      debug(`Could not read auth data from the ${this.fileName} file`, err);
      debug(
        "Maybe apl.get() was called before app was registered. Returning empty, fallback data (undefined)"
      );
      return void 0;
    }
    const { token, saleorApiUrl, appId, jwks } = parsedData;
    if (token && saleorApiUrl && appId) {
      debug("Token found, returning values: %s", `${token[0]}***`);
      const authData = { token, saleorApiUrl, appId };
      if (jwks) {
        authData.jwks = jwks;
      }
      return authData;
    }
    return void 0;
  }
  /**
   * Save auth data to file.
   * When `authData` argument is empty, will overwrite file with empty values.
   */
  async saveDataToFile(authData) {
    debug(`Trying to save auth data to the ${this.fileName} file`);
    const newData = authData ? JSON.stringify(authData) : "{}";
    try {
      await fsPromises.writeFile(this.fileName, newData);
      debug("Successfully written file %", this.fileName);
    } catch (err) {
      debug(`Could not save auth data to the ${this.fileName} file`, err);
      throw new Error("File APL was unable to save auth data");
    }
  }
  async get(saleorApiUrl) {
    const authData = await this.loadDataFromFile();
    if (saleorApiUrl === authData?.saleorApiUrl) {
      return authData;
    }
    return void 0;
  }
  async set(authData) {
    await this.saveDataToFile(authData);
  }
  async delete(saleorApiUrl) {
    const authData = await this.loadDataFromFile();
    if (saleorApiUrl === authData?.saleorApiUrl) {
      await this.saveDataToFile();
    }
  }
  async getAll() {
    const authData = await this.loadDataFromFile();
    if (!authData) {
      return [];
    }
    return [authData];
  }
};

// node_modules/.pnpm/@saleor+app-sdk@1.3.0_graph_fa17c376d9ced4b227b518ffdef3809c/node_modules/@saleor/app-sdk/APL/upstash/index.mjs
init_esm();
var debug2 = createAPLDebug("UpstashAPL");
var UpstashAPLVariables = {
  UPSTASH_TOKEN: "UPSTASH_TOKEN",
  UPSTASH_URL: "UPSTASH_URL"
};
var UpstashAplMisconfiguredError = class extends Error {
  static {
    __name(this, "UpstashAplMisconfiguredError");
  }
  constructor(missingVars) {
    super(
      `Configuration values for: ${missingVars.map((v) => `"${v}"`).join(", ")} not found or is empty. Pass values to constructor of use env variables.`
    );
    this.missingVars = missingVars;
  }
};
var UpstashAplNotConfiguredError = class extends Error {
  static {
    __name(this, "UpstashAplNotConfiguredError");
  }
};
var UpstashAPL = class {
  static {
    __name(this, "UpstashAPL");
  }
  constructor(config) {
    const restURL = config?.restURL || process.env[UpstashAPLVariables.UPSTASH_URL];
    const restToken = config?.restToken || process.env[UpstashAPLVariables.UPSTASH_TOKEN];
    this.restURL = restURL;
    this.restToken = restToken;
  }
  async upstashRequest(request) {
    debug2("Sending request to Upstash");
    if (!this.restURL || !this.restToken) {
      throw new Error(
        "UpstashAPL is not configured. See https://docs.saleor.io/docs/3.x/developer/extending/apps/developing-apps/app-sdk/apl"
      );
    }
    let response;
    try {
      response = await fetch(this.restURL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.restToken}` },
        body: JSON.stringify(request)
      });
    } catch (error) {
      debug2("Error during sending the data:", error);
      throw new Error(`UpstashAPL was unable to perform a request ${error}`);
    }
    const parsedResponse = await response.json();
    if (!response.ok || "error" in parsedResponse) {
      debug2(`Operation unsuccessful. Upstash API has responded with ${response.status} code`);
      if ("error" in parsedResponse) {
        debug2("Error message: %s", parsedResponse.error);
        throw new Error(
          `Upstash APL was not able to perform operation. Status code: ${response.status}. Error: ${parsedResponse.error}`
        );
      }
      throw new Error(
        `Upstash APL was not able to perform operation. Status code: ${response.status}`
      );
    }
    debug2("Upstash service responded successfully");
    return parsedResponse.result;
  }
  async saveDataToUpstash(authData) {
    debug2("saveDataToUpstash() called with: %j", {
      saleorApiUrl: authData.saleorApiUrl,
      token: authData.token.substring(0, 4)
    });
    const data = JSON.stringify(authData);
    await this.upstashRequest(["SET", authData.saleorApiUrl, data]);
  }
  async deleteDataFromUpstash(saleorApiUrl) {
    await this.upstashRequest(["DEL", saleorApiUrl]);
  }
  async fetchDataFromUpstash(saleorApiUrl) {
    const result = await this.upstashRequest(["GET", saleorApiUrl]);
    if (result) {
      const authData = JSON.parse(result);
      return authData;
    }
    return void 0;
  }
  async get(saleorApiUrl) {
    return this.fetchDataFromUpstash(saleorApiUrl);
  }
  async set(authData) {
    await this.saveDataToUpstash(authData);
  }
  async delete(saleorApiUrl) {
    await this.deleteDataFromUpstash(saleorApiUrl);
  }
  async getAll() {
    throw new Error("UpstashAPL does not support getAll method");
    return [];
  }
  // eslint-disable-next-line class-methods-use-this
  async isReady() {
    const missingConf = [];
    if (!this.restToken) {
      missingConf.push("restToken");
    }
    if (!this.restURL) {
      missingConf.push("restURL");
    }
    if (missingConf.length > 0) {
      return {
        ready: false,
        error: new UpstashAplMisconfiguredError(missingConf)
      };
    }
    return {
      ready: true
    };
  }
  async isConfigured() {
    return this.restToken && this.restURL ? {
      configured: true
    } : {
      configured: false,
      error: new UpstashAplNotConfiguredError(
        "UpstashAPL not configured. Check if REST URL and token provided in constructor or env"
      )
    };
  }
};

// src/saleor-app.ts
var apl;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  console.log("✅ UpstashAPL selected. KV_REST_API_URL is found.");
  apl = new UpstashAPL({
    restURL: process.env.KV_REST_API_URL,
    restToken: process.env.KV_REST_API_TOKEN
  });
} else {
  console.warn("⚠️ FileAPL selected. KV_REST_API_URL was NOT found.");
  console.log("Env check: URL exists?", !!process.env.KV_REST_API_URL, "Token exists?", !!process.env.KV_REST_API_TOKEN);
  apl = new FileAPL();
}
var saleorApp = new SaleorApp({
  apl
});

export {
  makeSaleorClient,
  ORDER_QUERY,
  WAREHOUSE_QUERY,
  FULFILLMENT_CREATE,
  UPDATE_ORDER_METADATA,
  apl
};
/*! Bundled license information:

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
//# sourceMappingURL=chunk-FFGKSNDT.mjs.map
