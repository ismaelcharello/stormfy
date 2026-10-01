import { expect, test, type Page } from "@playwright/test";
import { company, contact, diagnostic, opportunity, task } from "../fixtures";

async function start(page: Page) {
  await page.addInitScript((data) => localStorage.setItem("vexo_crm_local_data_v1", JSON.stringify(data)), {
    companies: [company], contacts: [contact], opportunities: [opportunity], tasks: [task], diagnostics: [diagnostic], interactions: [], activities: [],
  });
  await page.goto("/app");
  await page.getByRole("button", { name: "Abrir prévia local" }).click();
  await expect(page.getByRole("heading", { name: "Seu foco hoje" })).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const dialog = page.getByRole("dialog");
  if (await dialog.count()) expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
}
async function capture(page: Page, name: string, width: number) {
  if (process.env.STORMFY_SCREENSHOT_LOGS === "1" && [390, 1440].includes(width)) {
    console.log("STORMFY_SCREENSHOT_" + name + "_" + width + ":" + (await page.screenshot({ type: "jpeg", quality: 55, animations: "disabled" })).toString("base64"));
  }
}

for (const width of [360, 390, 768, 1024, 1440]) {
  test("company, meeting and pipeline at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await start(page); await noOverflow(page);
    await capture(page, "dashboard", width);
    await page.getByRole("button", { name: "Empresas", exact: true }).filter({ visible: true }).first().click();
    await page.getByRole("button", { name: "Ver ficha", exact: true }).first().click();
    await expect(page.getByRole("tab", { name: "Visão geral" })).toBeVisible();
    await noOverflow(page);
    await capture(page, "company", width);
    await page.getByRole("tab", { name: "Reuniões e atas" }).click();
    await expect(page.getByText(diagnostic.summary, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Registrar reunião", exact: true }).filter({ visible: true }).click();
    await expect(page.getByLabel("Empresa *", { exact: true })).toHaveValue(company.id);
    await page.getByLabel("Texto ou transcrição (opcional)").fill("Reunião sintética: apresentar parceiros estratégicos.");
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByLabel("Resumo da conversa *")).toHaveValue("Reunião sintética: apresentar parceiros estratégicos.");
    await page.getByLabel("O que fazer depois? (opcional)").fill("Enviar apresentação de teste");
    await page.getByLabel("Quando fazer o follow-up? (opcional)").fill("2026-10-08T10:00");
    const save = page.getByRole("button", { name: "Salvar reunião", exact: true });
    await expect(save).toBeInViewport();
    await noOverflow(page);
    await capture(page, "meeting", width);
    await save.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Ver ficha", exact: true }).first().click();
    await page.getByRole("tab", { name: "Reuniões e atas" }).click();
    await expect(page.getByText(diagnostic.summary, { exact: true })).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText("Ata salva", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("tabpanel").getByText("Reunião sintética: apresentar parceiros estratégicos.", { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Funil", exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText("Próximo passo", { exact: true }).first()).toBeVisible();
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("draft text and attachment notice survive a page reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.getByRole("button", { name: "Registrar reunião", exact: true }).filter({ visible: true }).click();
  await page.getByLabel("Empresa *", { exact: true }).selectOption(company.id);
  await page.locator('input[type="file"]').setInputFiles({ name: "ata-qa.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n" + "synthetic fixture ".repeat(20)) });
  await expect(page.getByText("Ata selecionada")).toBeVisible();
  await page.getByLabel("Texto ou transcrição (opcional)").fill("Rascunho que precisa sobreviver à atualização.");
  await page.reload();
  await page.getByRole("button", { name: "Abrir prévia local" }).click();
  await expect(page.getByText(/Rascunho recuperado/)).toBeVisible();
  await expect(page.getByText(/o navegador não restaurou o arquivo/)).toBeVisible();
  await expect(page.getByLabel("Texto ou transcrição (opcional)")).toHaveValue("Rascunho que precisa sobreviver à atualização.");
});

test("creates a company and a personal opportunity with an editable next step", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.getByRole("button", { name: "Empresas", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Nova empresa", exact: true }).click();
  await page.getByLabel("Nome *", { exact: true }).fill("Empresa criada no teste");
  await page.getByRole("button", { name: "Salvar empresa", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Empresa criada no teste", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Funil", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Nova oportunidade", exact: true }).click();
  await page.getByLabel("Título da oportunidade *").fill("Conexão estratégica de teste");
  await page.getByLabel("Empresa", { exact: true }).selectOption({ label: "Empresa criada no teste" });
  await page.getByLabel("Quem pode ver esta oportunidade?").selectOption("personal");
  await expect(page.getByRole("dialog").getByLabel("Responsável", { exact: true })).toBeDisabled();
  await page.getByLabel("Próximo passo", { exact: true }).fill("Confirmar a apresentação");
  await noOverflow(page);
  await page.getByRole("button", { name: "Salvar oportunidade", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Conexão estratégica de teste", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirmar a apresentação", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vexo_crm_local_data_v1") || "{}"));
  expect(saved.opportunities.find((item: { title: string }) => item.title === "Conexão estratégica de teste")).toMatchObject({ visibility: "personal", next_step: "Confirmar a apresentação" });
});
