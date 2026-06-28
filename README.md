# MyGym - Sistema de Gestão para Academias

Sistema completo para controle de alunos, matrículas, finanças, check-in por QR Code e comunicação via WhatsApp.

## 🚀 Setup Rápido

### 1. Instalar dependências

```bash
cd mygym
npm install
```

### 2. Configurar o Banco de Dados (Supabase)

1. Acesse: https://supabase.com/dashboard/project/kiifogmalbkcbwalhctc
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo do arquivo `supabase-schema.sql`

### 3. Rodar localmente

```bash
npm run dev
```

Acesse: http://localhost:3000

### 4. Deploy no GitHub Pages

```bash
npm run deploy
```

## 📁 Estrutura

```
src/
├── app/
│   ├── page.tsx                    # Login
│   ├── checkin/page.tsx            # Check-in público (QR Code)
│   ├── aluno/page.tsx              # Portal do Aluno
│   └── dashboard/
│       ├── page.tsx                # Dashboard (KPIs)
│       ├── alunos/page.tsx         # Gestão de Alunos
│       ├── modalidades/page.tsx    # Modalidades
│       ├── planos/page.tsx         # Planos
│       ├── matriculas/page.tsx     # Matrículas
│       ├── mensalidades/page.tsx   # Mensalidades + WhatsApp
│       ├── checkin/page.tsx        # Gerador QR Code
│       ├── horarios/page.tsx       # Grade de Horários
│       ├── convenios/page.tsx      # Convênios (Gympass, etc.)
│       ├── whatsapp/page.tsx       # Histórico de Envios
│       └── configuracoes/page.tsx  # Configurações (PIX, banco)
├── components/
│   ├── Sidebar.tsx
│   └── DashboardLayout.tsx
└── lib/
    └── supabase.ts
```

## 🔑 Funcionalidades

- ✅ Cadastro de alunos com convênio/desconto
- ✅ Planos (mensal, trimestral, anual)
- ✅ Matrículas com cálculo automático de desconto
- ✅ Mensalidades geradas automaticamente
- ✅ Controle financeiro (PIX/Conta bancária)
- ✅ Check-in por QR Code
- ✅ Portal do Aluno
- ✅ Envio de cobrança via WhatsApp (Whatsa.me)
- ✅ Histórico de notificações
- ✅ Dashboard com KPIs
- ✅ Grade de horários semanal

## 🔮 Futuro

- [ ] Integração Resend (e-mail boas-vindas)
- [ ] Webhook Hotmart (assinaturas)
- [ ] Avaliações físicas completas
- [ ] Treinos personalizados
