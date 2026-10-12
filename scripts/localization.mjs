/** Guards static JSX prose; runtime service messages still require review. */
export const localizedUi = {
  meta: { type: 'problem', schema: [], messages: { hardcoded: 'Use the bilingual message dictionary for user-facing text.' } },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    if (filename.includes('/perf/') || filename.endsWith('/main.tsx')) return {};
    const prose = text => typeof text === 'string' && /\p{L}/u.test(text.replaceAll('&nbsp;', '')) && text.trim() !== 'GharPlan';
    const report = (node, text) => { if (prose(text)) context.report({ node, messageId: 'hardcoded' }); };
    return {
      JSXText: node => report(node, node.value),
      JSXAttribute: node => {
        if (['aria-label', 'aria-description', 'title', 'placeholder', 'alt'].includes(node.name.name) && node.value?.type === 'Literal') report(node.value, node.value.value);
      },
      JSXExpressionContainer: node => { if (node.parent.type !== 'JSXAttribute' && node.expression.type === 'Literal') report(node.expression, node.expression.value); },
    };
  },
};
