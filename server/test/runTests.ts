import { normalizePhone, canonicalPhone } from '../src/services/phoneNormalizer';
import { cloudPrintService } from '../src/services/cloudPrintService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failed++;
  }
}

console.log('--- Iniciando Bateria de Testes do Backend PedeAi ---\n');

console.log('[Modulo: phoneNormalizer]');
assert(normalizePhone('') === '', 'Telefone vazio/nulo');
assert(normalizePhone('5533984266981') === '5533984266981', 'Numero normal com 55 e 11 digitos');
assert(normalizePhone('5533984266981:11@s.whatsapp.net') === '5533984266981', 'Remocao de sufixo :11@s.whatsapp.net');
assert(normalizePhone('5533984266981:2@c.us') === '5533984266981', 'Remocao de sufixo :2@c.us');
assert(normalizePhone('+55 (33) 98426-6981') === '5533984266981', 'Formatacao com caracteres especiais');
assert(normalizePhone('33984266981') === '5533984266981', 'Adicao automatica do DDI 55 em 11 digitos');
assert(normalizePhone('3384266981') === '553384266981', 'Adicao automatica do DDI 55 em 10 digitos');
assert(canonicalPhone('5533984266981') === '3384266981', 'Canonico: Remove 55 e nono digito');
assert(canonicalPhone('3384266981') === '3384266981', 'Canonico: Numero ja com 10 digitos');

console.log('\n[Modulo: cloudPrintService]');
const jobs = cloudPrintService.getPendingJobs('rest-teste-123');
assert(Array.isArray(jobs) && jobs.length === 0, 'Fila inicial vazia para novo restaurante');
const completeNonExistent = cloudPrintService.completeJob('non-existent-id');
assert(completeNonExistent === false, 'Completar job inexistente retorna false');

console.log('\n====================================================');
console.log(`Resultado dos Testes: ${passed} passaram | ${failed} falharam`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
}
