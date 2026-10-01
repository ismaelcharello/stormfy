"use client";

import { useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  KanbanSquare,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const benefits = [
  { icon: Users, title: "Prospecção organizada", text: "Centralize pessoas, empresas e todo o contexto comercial." },
  { icon: Target, title: "Funil comercial visual", text: "Acompanhe cada oportunidade até o fechamento." },
  { icon: Clock3, title: "Follow-ups no tempo certo", text: "Priorize atrasos e mantenha o próximo passo definido." },
  { icon: CalendarDays, title: "Reuniões no calendário", text: "Agende, edite e registre o resultado das conversas." },
  { icon: KanbanSquare, title: "Atividades em Kanban", text: "Organize entregas e tarefas compartilhadas com a equipe." },
  { icon: Building2, title: "Equipe compartilhada", text: "Trabalhe na mesma base com papéis e acessos controlados." },
  { icon: BarChart3, title: "Dashboards em tempo real", text: "Leia o funil e as prioridades a partir dos dados atuais." },
  { icon: MessageSquareText, title: "Histórico completo", text: "Registre ligações, mensagens, e-mails, reuniões e notas." },
];

const steps = [
  ["01", "Cadastre contatos e empresas", "Reúna dados essenciais sem perder o histórico da relação."],
  ["02", "Organize oportunidades", "Visualize cada negociação no funil e mova os cards entre as etapas."],
  ["03", "Defina os próximos passos", "Agende follow-ups, reuniões e atividades para cada responsável."],
  ["04", "Acompanhe pelo dashboard", "Identifique prioridades, atrasos e evolução da operação em uma só tela."],
];

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <span className="inline-flex items-center gap-3" aria-label="Stormfy">
    <span className={`grid size-10 place-items-center rounded-xl text-lg font-bold ${inverse ? "bg-[#c6a96b] text-white" : "bg-[#10233f] text-white"}`}>S</span>
    <span className={`text-lg font-semibold tracking-tight ${inverse ? "text-white" : "text-[#10233f]"}`}>Stormfy</span>
  </span>;
}

function DashboardPreview() {
  const bars = [42, 66, 54, 82, 62, 91, 74];
  return <div className="relative mx-auto w-full max-w-[680px]">
    <div className="absolute -inset-8 rounded-[40px] bg-[#c6a96b]/10 blur-3xl" />
    <div className="relative overflow-hidden rounded-[22px] border border-white/15 bg-[#f8f5ee] shadow-2xl shadow-black/30">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3"><span className="size-2.5 rounded-full bg-[#c6a96b]" /><span className="size-2.5 rounded-full bg-slate-200" /><span className="size-2.5 rounded-full bg-slate-200" /><span className="ml-auto rounded-full bg-[#f3ead7] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[#765b2e]">Exemplo de visualização</span></div>
      <div className="grid min-h-[410px] grid-cols-[74px_1fr] sm:grid-cols-[150px_1fr]">
        <aside className="bg-[#10233f] p-3 sm:p-4"><div className="grid size-9 place-items-center rounded-lg bg-[#c6a96b] font-bold text-white">S</div><div className="mt-7 space-y-2">{["Resumo", "Contatos", "Funil", "Atividades", "Calendário"].map((item, index) => <div key={item} className={`rounded-lg px-3 py-2 text-xs ${index === 0 ? "bg-white/10 font-medium text-white" : "text-[#d8c79f]"}`}><span className="sm:hidden">{item.slice(0,1)}</span><span className="hidden sm:inline">{item}</span></div>)}</div></aside>
        <div className="min-w-0 p-4 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#9a793e]">Visão comercial</p><h3 className="mt-1 text-lg font-semibold text-[#10233f]">Dashboard</h3></div><span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">Últimos 30 dias</span></div>
          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">{[["Contatos ativos","—"],["Funil aberto","—"],["Follow-ups","—"],["Reuniões","—"]].map(([label,value], index) => <div key={label} className={`rounded-xl border p-3 ${index === 0 ? "border-[#d9c494] bg-[#fffaf0]" : "border-slate-200 bg-white"}`}><p className="text-[10px] text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-[#10233f]">{value}</p></div>)}</div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_.8fr]"><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#10233f]">Evolução comercial</p><span className="text-[10px] text-slate-400">Dados do workspace</span></div><div className="mt-5 flex h-28 items-end gap-2 border-b border-l border-slate-100 px-2">{bars.map((height,index) => <div key={index} className="flex-1 rounded-t bg-[#173052]" style={{ height: `${height}%`, opacity: .52 + index * .065 }} />)}</div><div className="mt-2 flex justify-between text-[9px] text-slate-400"><span>Início</span><span>Hoje</span></div></div>
            <div className="rounded-xl bg-[#10233f] p-4 text-white"><p className="text-xs font-semibold">Próximos passos</p><div className="mt-4 space-y-3">{["Retornar proposta", "Reunião comercial", "Revisar oportunidade"].map((item,index) => <div key={item} className="flex gap-2"><span className={`mt-1 size-2 rounded-full ${index === 0 ? "bg-[#c6a96b]" : "bg-white/30"}`} /><div><p className="text-[11px] font-medium">{item}</p><p className="mt-0.5 text-[9px] text-[#d8c79f]">Responsável e prazo</p></div></div>)}</div></div></div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#10233f]">Funil de oportunidades</p><span className="text-[10px] text-[#9a793e]">Abrir funil</span></div><div className="mt-3 grid grid-cols-4 gap-2">{["Novo lead","Qualificação","Proposta","Negociação"].map((item,index) => <div key={item} className="rounded-lg bg-slate-50 p-2"><span className="block h-1 rounded-full bg-[#c6a96b]" style={{ width: `${88-index*14}%` }} /><p className="mt-2 truncate text-[9px] text-slate-500">{item}</p></div>)}</div></div>
        </div>
      </div>
    </div>
  </div>;
}

export function LandingPage() {
  useEffect(() => {
    const authResponse = window.location.hash.includes("access_token=") || window.location.search.includes("code=");
    const invite = new URLSearchParams(window.location.hash.slice(1)).has("convite");
    if (authResponse || invite) window.location.replace(`/app${window.location.search}${window.location.hash}`);
  }, []);

  return <main className="min-h-screen overflow-x-hidden bg-[#f8f5ee] text-[#10233f]">
    <header className="sticky top-0 z-50 border-b border-[#10233f]/10 bg-[#f8f5ee]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between gap-5 px-5 lg:px-8"><a href="#inicio"><Logo /></a><nav className="hidden items-center gap-7 text-sm font-medium text-[#40516a] lg:flex" aria-label="Navegação principal"><a className="transition hover:text-[#10233f]" href="#recursos">Recursos</a><a className="transition hover:text-[#10233f]" href="#como-funciona">Como funciona</a><a className="transition hover:text-[#10233f]" href="#dashboard">Dashboard</a><a className="transition hover:text-[#10233f]" href="#seguranca">Equipe</a></nav><a href="/app" className="inline-flex items-center gap-2 rounded-lg bg-[#c6a96b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b89553]">Acessar o CRM <ArrowRight className="size-4" /></a></div>
    </header>

    <section id="inicio" className="relative overflow-hidden bg-[#10233f] text-white"><div className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 72% 20%, #c6a96b 0, transparent 22%), radial-gradient(circle at 88% 85%, #315477 0, transparent 28%)" }} /><div className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-5 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-8 lg:py-28"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-[#e1cfa8]"><Sparkles className="size-3.5" /> Gestão comercial com clareza</span><h1 className="mt-7 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-.04em] sm:text-5xl lg:text-[64px]">Organize sua operação comercial. <span className="text-[#d7bd83]">Transforme conversas em próximos passos.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-[#d8dfe8] sm:text-lg">Stormfy reúne contatos, oportunidades, follow-ups, reuniões, atividades e indicadores em uma plataforma compartilhada para sua equipe vender com mais clareza.</p><div className="mt-9 flex flex-wrap gap-3"><a href="/app" className="inline-flex items-center gap-2 rounded-lg bg-[#c6a96b] px-5 py-3.5 font-semibold text-white transition hover:bg-[#b89553]">Acessar o CRM <ArrowRight className="size-4" /></a><a href="#recursos" className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[.05] px-5 py-3.5 font-semibold text-white transition hover:bg-white/10">Conhecer recursos <ChevronRight className="size-4" /></a></div><div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#c7d0dc]"><span className="inline-flex items-center gap-2"><Check className="size-4 text-[#d7bd83]" /> Dados compartilhados</span><span className="inline-flex items-center gap-2"><Check className="size-4 text-[#d7bd83]" /> Acesso protegido</span><span className="inline-flex items-center gap-2"><Check className="size-4 text-[#d7bd83]" /> Desktop e celular</span></div></div><DashboardPreview /></div></section>

    <section id="recursos" className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.16em] text-[#9a793e]">Operação em um só lugar</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em] text-[#10233f] sm:text-4xl">Menos informação espalhada. Mais clareza para agir.</h2><p className="mt-4 text-base leading-7 text-slate-600">Do primeiro contato à reunião, cada registro permanece ligado ao histórico e ao próximo passo.</p></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{benefits.map(({icon:Icon,title,text}) => <article key={title} className="group rounded-2xl border border-[#ded8cb] bg-[#fffdfa] p-5 transition hover:-translate-y-1 hover:border-[#c6a96b] hover:shadow-lg hover:shadow-[#10233f]/5"><span className="grid size-11 place-items-center rounded-xl bg-[#f1e7d2] text-[#173052]"><Icon className="size-5" /></span><h3 className="mt-5 font-semibold text-[#10233f]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></section>

    <section id="dashboard" className="border-y border-[#10233f]/10 bg-white"><div className="mx-auto grid max-w-[1240px] items-center gap-14 px-5 py-20 lg:grid-cols-[.72fr_1.28fr] lg:px-8 lg:py-28"><div><p className="text-sm font-semibold uppercase tracking-[.16em] text-[#9a793e]">Uma visão clara da operação</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em] text-[#10233f] sm:text-4xl">O que precisa de atenção aparece primeiro.</h2><p className="mt-5 text-base leading-7 text-slate-600">O dashboard transforma os registros do workspace em indicadores, prioridades e atalhos práticos. Sem planilhas paralelas e sem números inventados.</p><ul className="mt-7 space-y-4 text-sm text-slate-700">{["Indicadores comerciais com filtros por período e responsável","Funil por etapa, quantidade e valor estimado","Follow-ups atrasados e reuniões próximas","Resumo de contatos, atividades e responsáveis"].map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#b49150]" /><span>{item}</span></li>)}</ul><a href="/app" className="mt-8 inline-flex items-center gap-2 font-semibold text-[#173052] hover:text-[#9a793e]">Abrir o dashboard <ArrowRight className="size-4" /></a></div><DashboardPreview /></div></section>

    <section id="como-funciona" className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28"><div className="text-center"><p className="text-sm font-semibold uppercase tracking-[.16em] text-[#9a793e]">Do contato ao próximo passo</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.03em] text-[#10233f] sm:text-4xl">Um fluxo simples para a equipe comercial.</h2></div><div className="mt-12 grid gap-4 lg:grid-cols-4">{steps.map(([number,title,text],index) => <article key={number} className="relative rounded-2xl border border-[#ded8cb] bg-[#fffdfa] p-6"><span className="text-sm font-semibold text-[#b49150]">{number}</span><h3 className="mt-8 text-lg font-semibold text-[#10233f]">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>{index < steps.length-1 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden size-6 rounded-full border border-[#ded8cb] bg-[#f8f5ee] p-1 text-[#9a793e] lg:block" />}</article>)}</div></section>

    <section id="seguranca" className="bg-[#e9dfca]"><div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-16 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:px-8"><span className="grid size-14 place-items-center rounded-2xl bg-[#10233f] text-[#e1cfa8]"><ShieldCheck className="size-7" /></span><div><h2 className="text-2xl font-semibold tracking-[-.02em] text-[#10233f]">Seus dados comerciais ficam protegidos.</h2><p className="mt-2 max-w-3xl leading-7 text-[#40516a]">A autenticação e as regras de acesso por equipe garantem que cada pessoa consulte somente o workspace autorizado.</p></div><span className="inline-flex items-center gap-2 rounded-full border border-[#10233f]/15 bg-white/40 px-4 py-2 text-sm font-semibold text-[#10233f]"><LockKeyhole className="size-4" /> Acesso por convite</span></div></section>

    <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8"><div className="overflow-hidden rounded-[28px] bg-[#10233f] px-6 py-14 text-center text-white sm:px-10 lg:py-20"><p className="text-sm font-semibold uppercase tracking-[.16em] text-[#d7bd83]">Stormfy CRM</p><h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-[-.03em] sm:text-5xl">Seu comercial não precisa depender da memória.</h2><p className="mx-auto mt-5 max-w-2xl leading-7 text-[#c7d0dc]">Centralize contatos, oportunidades, tarefas e reuniões para que o próximo passo esteja sempre claro.</p><a href="/app" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#c6a96b] px-5 py-3.5 font-semibold text-white transition hover:bg-[#b89553]">Entrar no Stormfy <ArrowRight className="size-4" /></a></div></section>

    <footer className="border-t border-[#10233f]/10 bg-[#f1ede4]"><div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8"><Logo /><p className="text-sm text-slate-500">Gestão comercial com clareza.</p><a href="/app" className="inline-flex items-center gap-2 text-sm font-semibold text-[#173052] hover:text-[#9a793e]">Entrar no CRM <ArrowRight className="size-4" /></a></div></footer>
  </main>;
}
