import { AuraDefType } from '../fast-sfdc'

export default {
  getAuraTemplate (auraType: AuraDefType) {
    switch (auraType) {
      case 'CONTROLLER':
        return '({\n  method1: function (cmp, evt, h) {\n  }\n})'
      case 'HELPER':
        return '({\n  helperMethod: function() {\n\n  }\n})'
      case 'STYLE':
        return '.THIS {\n}'
      case 'DOCUMENTATION':
        return '<aura:documentation>\n  <aura:description>Documentation</aura:description>\n  ' +
          '<aura:example name="ExampleName" ref="exampleComponentName" label="Label">\n    ' +
          'Example Description\n  </aura:example>\n</aura:documentation>'
      case 'RENDERER':
        return '({\n  // Your renderer method overrides go here\n})'
      case 'DESIGN':
        return '<design:component>\n\n</design:component>'
      case 'SVG':
        return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg version="1.1"' +
          ' xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n\n</svg>'
      default:
        return '{}'
    }
  }
}
