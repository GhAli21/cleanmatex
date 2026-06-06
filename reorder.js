const fs = require('fs');

const file = 'web-admin/src/features/orders/ui/payment-modal-v4.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

function getChunk(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n');
}

// Extract chunks
const beforeRightPanel = getChunk(1, 3419);
// Line 3420 is `<div className="space-y-4">`
const customer = getChunk(3421, 3440);
const balanceResult = getChunk(3442, 3492);
const requiredAction = getChunk(3494, 3520);
const settlementNow = getChunk(3522, 3574);
const balancePolicy = getChunk(3575, 3627);
const adjustments = getChunk(3628, 3868);
const orderValue = getChunk(3870, 3886);
const cashDrawer = getChunk(3888, 3962);
const b2bAR = getChunk(3964, 4057);
const currency = getChunk(4058, 4078);
const paymentNotes = getChunk(4080, 4116);
const warnings = getChunk(4117, 4136);

// After right panel: line 4137 is `</div>` (closes right panel div), 4138 is `</div>` (closes grid div), etc.
const afterRightPanel = getChunk(4137, lines.length);

// We need to modify `balanceResult` slightly to make it look good in the sticky footer.
// Actually, Balance Result is `<div className="md:sticky md:top-0 md:z-10 md:pb-1"> ... </div>`
// Let's just leave it as is, but we will put it inside our new sticky footer block, so we strip the wrapper.
// Or we just modify the class of the wrapper:
let modifiedBalanceResult = balanceResult.replace(
  'md:sticky md:top-0 md:z-10 md:pb-1',
  'border-t border-slate-200'
);
// It already has a CmxCard inside it.

let modifiedRequiredAction = requiredAction;

// Reassemble Right Panel
const newRightPanel = `                <div className="relative flex flex-col bg-slate-50/50 lg:col-span-5 xl:col-span-4">
                  <div className="flex-1 space-y-4 overflow-y-auto p-6 pb-32">
${orderValue}
${customer}
${adjustments}
${settlementNow}
${balancePolicy}
${cashDrawer}
${b2bAR}
${currency}
${paymentNotes}
${warnings}
                  </div>
                  <div className="sticky bottom-0 z-10 space-y-4 bg-white/95 p-6 shadow-[0_-8px_16px_-4px_rgb(0,0,0,0.05)] backdrop-blur">
${modifiedRequiredAction}
${modifiedBalanceResult}
                  </div>`;

const newContent = beforeRightPanel + '\n' + newRightPanel + '\n' + afterRightPanel;
fs.writeFileSync(file, newContent, 'utf8');
console.log('Successfully reordered components!');
