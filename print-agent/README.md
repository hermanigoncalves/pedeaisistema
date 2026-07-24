# PedeAí — Agente Local de Impressão

Imprime automaticamente pedidos e fechamentos de conta **sem nenhum diálogo** diretamente em impressoras USB ou de rede.

---

## Como usar

### 1. Pré-requisitos
- [Node.js 18+](https://nodejs.org) instalado no PC do restaurante

### 2. Configurar
```
Copie .env.example → .env
Edite o .env com:
  - URL e chave do Supabase
  - IP das impressoras (ou nome USB no Windows)
```

### 3. Iniciar
**Opção A — Duplo clique:**
```
INICIAR.bat
```

**Opção B — Terminal:**
```bash
npm install
npm start
```

---

## Configuração das impressoras no `.env`

### Impressora de rede (TCP/IP)
```env
PRINTER_KITCHEN_TYPE=tcp
PRINTER_KITCHEN_HOST=192.168.1.100
PRINTER_KITCHEN_PORT=9100
```

### Impressora USB (Windows)
```env
PRINTER_KITCHEN_TYPE=usb
PRINTER_KITCHEN_USB=\\.\USB001
```
> Dica: Para descobrir o nome USB no Windows, abra o PowerShell e rode:
> `Get-WmiObject Win32_Printer | Select Name, PortName`

---

## Fluxo de impressão

| Evento | Onde imprime |
|---|---|
| Novo pedido (bebidas) | Impressora do Bar |
| Novo pedido (comidas) | Impressora da Cozinha |
| Fechamento de conta | Impressora de Recibo |

Os itens são classificados **automaticamente** por palavras-chave no nome do produto.

---

## Manter o agente sempre ativo

Para iniciar automaticamente com o Windows, crie um atalho do `INICIAR.bat` em:
```
C:\Users\SEU_USUARIO\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\
```

Ou use o [NSSM](https://nssm.cc/) para rodar como serviço Windows.
