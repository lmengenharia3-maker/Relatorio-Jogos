const checklistItems = [
  "Houve reunião de alinhamento",
  "Posto Médico e/ou Ambulâncias disponibilizadas",
  "BEPE autorizou a abertura dos portões no horário previsto",
  "Presença de alguma autoridade dos poderes públicos (governo, prefeitura ou tribunais)",
  "Portas das escadas N7 resguardadas com segurança",
  "Delegacia ativada para registro de ocorrências",
  "Saídas de emergência desobstruídas (escadas)",
  "Houve controle dos materiais da organizada pela PM",
  "Houve alguma ocorrência registrada nos estacionamentos",
  "Houve presença de ambulantes, catadores de latas ou garrafas no EDG",
  "Indicações de saída fixadas em local visível",
  "Bombeiros Militares presentes no evento",
  "Controle externo de garrafas de vidro pela autoridade responsável",
  "Os elevadores disponibilizados estão em funcionamento pleno",
  "Ações do ECB geraram algum impacto ou incidente durante o jogo",
  "Revista pessoal apoiada pela Polícia Militar na retaguarda",
  "Houve algum incidente registrado provocado pela organizada",
  "Houve presença de ambulantes nos portões de acesso",
];

const kpiItems = [
  "Furto",
  "Roubo",
  "Incidente com arma de fogo",
  "Incidente com perfuro-cortante",
  "Registro de morte",
  "Outros (crimes)",
  "Incidente com garrafas de vidro",
  "Incidente com elevadores",
  "Danos/vandalismo ao patrimônio",
  "Incidentes provocados por superlotação",
  "Invasões",
  "Briga entre torcidas rivais",
  "Modo contador",
  "Ocorrências de instabilidade nas catracas",
  "Marketing de emboscada",
];

const state = {
  photos: [],
};

const form = document.querySelector("#reportForm");
const checklist = document.querySelector("#checklist");
const kpiBody = document.querySelector("#kpiTable tbody");
const preview = document.querySelector("#reportPreview");
const photoInput = document.querySelector("#photoInput");
const photoList = document.querySelector("#photoList");

function init() {
  renderChecklist();
  renderKpis();
  bindEvents();
  loadDraft();
  updatePreview();
}

function renderChecklist() {
  checklist.innerHTML = checklistItems
    .map((question, index) => {
      const name = `check_${index}`;
      return `
        <div class="check-row">
          <div class="check-question">${escapeHtml(question)}</div>
          ${["Sim", "Não", "Parcialmente"]
            .map(
              (option) => `
                <label class="radio-pill">
                  <input type="radio" name="${name}" value="${option}" />
                  ${option}
                </label>
              `,
            )
            .join("")}
        </div>
      `;
    })
    .join("");
}

function renderKpis() {
  kpiBody.innerHTML = kpiItems
    .map(
      (item, index) => `
        <tr>
          <td>${escapeHtml(item)}</td>
          <td><input name="kpi_${index}_qtd" type="number" min="0" value="0" /></td>
          <td><input name="kpi_${index}_setor" /></td>
          <td><input name="kpi_${index}_obs" /></td>
        </tr>
      `,
    )
    .join("");
}

function bindEvents() {
  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);

  photoInput.addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    const loaded = await Promise.all(files.map(readPhoto));
    state.photos.push(...loaded);
    event.target.value = "";
    renderPhotos();
    updatePreview();
  });

  document.querySelector("#downloadPdf").addEventListener("click", async () => {
    const data = collectData();
    const pdf = await buildPdf(data);
    const url = URL.createObjectURL(pdf);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeReportFileName(data);
    link.click();
    URL.revokeObjectURL(url);
  });

  document.querySelector("#printPreview").addEventListener("click", () => window.print());

  document.querySelector("#saveDraft").addEventListener("click", () => {
    localStorage.setItem("relatorioJogosDraft", JSON.stringify(collectData()));
    alert("Rascunho salvo neste navegador.");
  });

  document.querySelector("#clearForm").addEventListener("click", () => {
    if (!confirm("Limpar todos os campos do relatório?")) return;
    localStorage.removeItem("relatorioJogosDraft");
    form.reset();
    state.photos = [];
    renderPhotos();
    updatePreview();
  });
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: crypto.randomUUID(),
        name: file.name,
        dataUrl: reader.result,
        caption: "",
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderPhotos() {
  photoList.innerHTML = state.photos
    .map(
      (photo) => `
        <div class="photo-item">
          <img src="${photo.dataUrl}" alt="" />
          <input data-photo-caption="${photo.id}" value="${escapeAttribute(photo.caption)}" placeholder="Legenda da foto" />
        </div>
      `,
    )
    .join("");

  photoList.querySelectorAll("[data-photo-caption]").forEach((input) => {
    input.addEventListener("input", () => {
      const photo = state.photos.find((item) => item.id === input.dataset.photoCaption);
      if (photo) photo.caption = input.value;
      updatePreview();
    });
  });
}

function collectData() {
  const fields = Object.fromEntries(new FormData(form).entries());
  const checks = checklistItems.map((question, index) => ({
    question,
    status: fields[`check_${index}`] || "",
  }));
  const kpis = kpiItems.map((type, index) => ({
    type,
    quantity: Number(fields[`kpi_${index}_qtd`] || 0),
    sector: fields[`kpi_${index}_setor`] || "",
    note: fields[`kpi_${index}_obs`] || "",
  }));

  return {
    fields,
    checks,
    kpis,
    photos: state.photos,
  };
}

function loadDraft() {
  const raw = localStorage.getItem("relatorioJogosDraft");
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    Object.entries(draft.fields || {}).forEach(([name, value]) => {
      const controls = form.querySelectorAll(`[name="${CSS.escape(name)}"]`);
      controls.forEach((control) => {
        if (control.type === "radio") {
          control.checked = control.value === value;
        } else {
          control.value = value;
        }
      });
    });
    state.photos = draft.photos || [];
    renderPhotos();
  } catch {
    localStorage.removeItem("relatorioJogosDraft");
  }
}

function updatePreview() {
  const data = collectData();
  const f = data.fields;
  const activeKpis = data.kpis.filter((item) => item.quantity || item.sector || item.note);
  const chartKpis = data.kpis.filter((item) => item.quantity > 0);

  preview.innerHTML = `
    <div class="template-frame">
      <header class="report-header">
        <div class="brand-lockup">
          <img src="assets/logo-nm.jpg" alt="NM Engenharia & Consultoria" />
        </div>
        <h2>Relatório de Evento ${valueOrDash(f.numeroRelatorio)}</h2>
        <div class="orange-rule"></div>
      <div class="report-meta">
        <span><strong>Tipo:</strong> ${valueOrDash(f.tipoEvento)}</span>
        <span><strong>Equipes:</strong> ${valueOrDash(f.equipes)}</span>
        <span><strong>Data:</strong> ${formatDate(f.dataEvento)}</span>
        <span><strong>Horário:</strong> ${valueOrDash(f.horario)}</span>
      </div>
    </header>

    <section class="report-block">
      <h3>Identificações gerais</h3>
      <div class="summary-grid">
        ${previewLine("Local", f.localEvento)}
        ${previewLine("Área de interesse", f.areaInteresse)}
        ${previewLine("Capacidade", f.capacidade)}
        ${previewLine("Expectativa de público", f.expectativaPublico)}
        ${previewLine("Quantidade de público", f.quantidadePublico)}
        ${previewLine("Abertura dos portões", f.aberturaPortoes)}
        ${previewLine("Borderô", f.bordero)}
      </div>
    </section>

    <section class="report-block">
      <h3>Informações operacionais</h3>
      <table class="mini-table">
        <tbody>
          ${data.checks
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.question)}</td>
                  <td class="${statusClass(item.status)}">${valueOrDash(item.status)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </section>

    <section class="report-block">
      <h3>Observação</h3>
      <p class="justified">${formatParagraphs(correctPortugueseText(f.informacoesAdicionais || "—"))}</p>
    </section>

    <section class="report-block">
      <h3>Dados estratificados</h3>
      <table class="mini-table">
        <thead>
          <tr><th>Ocorrência</th><th>Qtd.</th><th>Setor</th><th>Observação</th></tr>
        </thead>
        <tbody>
          ${(activeKpis.length ? activeKpis : data.kpis.slice(0, 5))
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${item.quantity || 0}</td>
                  <td>${valueOrDash(item.sector)}</td>
                  <td>${valueOrDash(item.note)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      ${renderBarChart(chartKpis)}
    </section>

    ${
      data.photos.length
        ? `
          <section class="report-block">
            <h3>Relatório fotográfico</h3>
            <div class="preview-photos">
              ${data.photos
                .map(
                  (photo) => `
                    <figure>
                      <img src="${photo.dataUrl}" alt="" />
                      <figcaption>${valueOrDash(photo.caption || photo.name)}</figcaption>
                    </figure>
                  `,
                )
                .join("")}
            </div>
          </section>
        `
        : ""
    }
      <footer class="report-footer">
        <span>Análise de Risco</span>
        <strong>NM Engenharia e Consultoria</strong>
        <span>Segurança em Estádios</span>
      </footer>
    </div>
  `;
}

function renderBarChart(items) {
  if (!items.length) return "";
  const max = Math.max(...items.map((item) => item.quantity), 1);
  return `
    <div class="bar-chart" aria-label="Gráfico de barras de ocorrências">
      ${items
        .map((item) => {
          const width = Math.max(5, Math.round((item.quantity / max) * 100));
          return `
            <div class="bar-row">
              <span>${escapeHtml(item.type)}</span>
              <div class="bar-track"><i style="width: ${width}%"></i></div>
              <strong>${item.quantity}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function previewLine(label, value) {
  return `<span><strong>${escapeHtml(label)}:</strong> ${valueOrDash(value)}</span>`;
}

function statusClass(status) {
  return `status-${String(status || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`;
}

function valueOrDash(value) {
  return escapeHtml(value || "—");
}

function formatParagraphs(value) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replaceAll("\n", "<br />"))
    .join("</p><p class=\"justified\">");
}

function correctPortugueseText(value) {
  return String(value || "")
    .replace(/\bocorrencias\b/gi, "ocorrências")
    .replace(/\bocorrencia\b/gi, "ocorrência")
    .replace(/\bseguranca\b/gi, "segurança")
    .replace(/\borgaos\b/gi, "órgãos")
    .replace(/\bpublico\b/gi, "público")
    .replace(/\bhorario\b/gi, "horário")
    .replace(/\bportoes\b/gi, "portões")
    .replace(/\bestadios\b/gi, "estádios")
    .replace(/\boperacional\b/gi, "operacional")
    .replace(/\banalise\b/gi, "análise")
    .replace(/\breuniao\b/gi, "reunião")
    .replace(/\bmedico\b/gi, "médico")
    .replace(/\bambulancias\b/gi, "ambulâncias")
    .replace(/\bautoridade\b/gi, "autoridade")
    .replace(/\bemergencia\b/gi, "emergência")
    .replace(/\bpatrimonio\b/gi, "patrimônio")
    .replace(/\bobservacao\b/gi, "observação");
}

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function makeReportFileName(data) {
  const team = (data.fields.equipes || "relatorio").replace(/[^\w-]+/g, "-").replace(/-+/g, "-");
  const date = data.fields.dataEvento || new Date().toISOString().slice(0, 10);
  return `relatorio-${team}-${date}.pdf`.toLowerCase();
}

async function buildPdf(data) {
  const pdf = new SimplePdf();
  const f = data.fields;
  const logo = await imageToJpeg("assets/logo-nm.jpg", 0.9);

  pdf.addTemplateHeader(`Relatório de Evento ${f.numeroRelatorio || ""}`, logo);
  pdf.addLine(`Tipo de evento: ${f.tipoEvento || "futebolístico"}`);
  pdf.addLine(`Equipes: ${f.equipes || "-"}`);
  pdf.addLine(`Data do evento: ${formatDate(f.dataEvento)}    Horário: ${f.horario || "-"}`);
  pdf.addLine(`Local do evento: ${f.localEvento || "-"}`);
  pdf.addLine(`Área de interesse: ${f.areaInteresse || "-"}`);
  pdf.addLine(`Capacidade: ${f.capacidade || "-"}    Expectativa: ${f.expectativaPublico || "-"}    Público: ${f.quantidadePublico || "-"}`);
  pdf.addLine(`Abertura dos portões: ${f.aberturaPortoes || "-"}    Borderô: ${f.bordero || "-"}`);

  pdf.addSection("2. INFORMAÇÕES OPERACIONAIS");
  data.checks.forEach((item) => {
    pdf.addWrapped(`${item.question}: ${item.status || "-"}`, 10);
  });

  pdf.addSection("3. OBSERVAÇÃO");
  pdf.addParagraph(correctPortugueseText(f.informacoesAdicionais || "-"));

  pdf.addSection("ANEXO - DADOS ESTRATIFICADOS");
  data.kpis.forEach((item) => {
    if (!item.quantity && !item.sector && !item.note) return;
    pdf.addWrapped(`${item.type} | Qtd.: ${item.quantity || 0} | Setor: ${item.sector || "-"} | Obs.: ${item.note || "-"}`, 10);
  });
  pdf.addBarChart(data.kpis.filter((item) => item.quantity > 0));

  if (data.photos.length) {
    pdf.addSection("RELATÓRIO FOTOGRÁFICO");
    for (const photo of data.photos) {
      const jpeg = await imageToJpeg(photo.dataUrl);
      pdf.addImage(jpeg.bytes, jpeg.width, jpeg.height, photo.caption || photo.name);
    }
  }

  pdf.addFinalFooter();
  return pdf.toBlob();
}

class SimplePdf {
  constructor() {
    this.width = 595.28;
    this.height = 841.89;
    this.margin = 42;
    this.contentWidth = this.width - this.margin * 2;
    this.pages = [];
    this.images = [];
    this.newPage();
  }

  newPage() {
    this.current = { lines: [], images: [] };
    this.pages.push(this.current);
    this.y = this.height - this.margin;
    this.addPageDecor();
  }

  ensure(space) {
    if (this.y - space < this.margin) this.newPage();
  }

  addPageDecor() {
    this.current.lines.push("q 0.00 0.43 0.75 rg 0 0 18 841.89 re f Q");
    this.current.lines.push("q 0.95 0.42 0.06 rg 18 35 0.8 735 re f Q");
  }

  addTemplateHeader(text, logo) {
    this.ensure(112);
    this.addImageAt(logo.bytes, logo.width, logo.height, this.margin, this.y - 76, 255, 110);
    this.y -= 104;
    this.addHeading(text);
  }

  addHeading(text) {
    this.ensure(36);
    this.current.lines.push(`BT /F1 21 Tf 0.00 0.14 0.36 rg ${this.margin} ${this.y} Td (${pdfText(text)}) Tj ET`);
    this.y -= 9;
    this.current.lines.push(`q 0.95 0.42 0.06 rg ${this.margin} ${this.y} 88 2 re f Q`);
    this.y -= 24;
  }

  addSection(text) {
    this.ensure(34);
    this.y -= 10;
    this.current.lines.push(`BT /F1 12.5 Tf 0.00 0.14 0.36 rg ${this.margin} ${this.y} Td (${pdfText(text)}) Tj ET`);
    this.y -= 18;
  }

  addLine(text) {
    this.ensure(18);
    this.current.lines.push(`BT /F1 10 Tf 0 0 0 rg ${this.margin} ${this.y} Td (${pdfText(text)}) Tj ET`);
    this.y -= 15;
  }

  addWrapped(text, indent = 0) {
    const max = indent ? 88 : 96;
    wrapText(text, max).forEach((line) => {
      this.ensure(16);
      this.current.lines.push(`BT /F1 9.5 Tf 0 0 0 rg ${this.margin + indent} ${this.y} Td (${pdfText(line)}) Tj ET`);
      this.y -= 14;
    });
  }

  addParagraph(text) {
    String(text || "-")
      .split(/\n{2,}/)
      .forEach((paragraph, index) => {
        if (index) this.y -= 8;
        const lines = wrapText(paragraph.replace(/\n/g, " "), 96);
        lines.forEach((line, lineIndex) => {
          this.ensure(16);
          const shouldJustify = lineIndex < lines.length - 1 && line.trim().split(/\s+/).length > 3;
          const wordSpacing = shouldJustify ? this.justifiedWordSpacing(line, 9.7, this.contentWidth) : 0;
          this.current.lines.push(`BT /F1 9.7 Tf 0 0 0 rg ${wordSpacing.toFixed(2)} Tw ${this.margin} ${this.y} Td (${pdfText(line)}) Tj 0 Tw ET`);
          this.y -= 15;
        });
      });
  }

  justifiedWordSpacing(line, fontSize, targetWidth) {
    const gaps = line.trim().split(/\s+/).length - 1;
    if (gaps <= 0) return 0;
    const width = approximateTextWidth(line, fontSize);
    return Math.max(0, Math.min(4.25, (targetWidth - width) / gaps));
  }

  addImage(bytes, imageWidth, imageHeight, caption) {
    const boxWidth = 250;
    const boxHeight = Math.min(190, (imageHeight / imageWidth) * boxWidth);
    this.ensure(boxHeight + 34);
    const name = `Im${this.images.length + 1}`;
    const image = { name, bytes, width: imageWidth, height: imageHeight };
    this.images.push(image);
    this.current.images.push(image);
    const x = this.margin;
    const y = this.y - boxHeight;
    this.current.lines.push(`q ${boxWidth} 0 0 ${boxHeight} ${x} ${y} cm /${name} Do Q`);
    this.y = y - 13;
    this.addWrapped(caption || "-", 0);
    this.y -= 8;
  }

  addImageAt(bytes, imageWidth, imageHeight, x, y, boxWidth, boxHeight) {
    const ratio = Math.min(boxWidth / imageWidth, boxHeight / imageHeight);
    const drawWidth = imageWidth * ratio;
    const drawHeight = imageHeight * ratio;
    const name = `Im${this.images.length + 1}`;
    const image = { name, bytes, width: imageWidth, height: imageHeight };
    this.images.push(image);
    this.current.images.push(image);
    this.current.lines.push(`q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x} ${(y + (boxHeight - drawHeight)).toFixed(2)} cm /${name} Do Q`);
  }

  addBarChart(items) {
    if (!items.length) return;
    this.ensure(58 + items.length * 20);
    const chartTop = this.y - 8;
    const labelWidth = 172;
    const barWidth = this.contentWidth - labelWidth - 44;
    const max = Math.max(...items.map((item) => item.quantity), 1);
    this.current.lines.push(`BT /F1 10.5 Tf 0.00 0.14 0.36 rg ${this.margin} ${chartTop} Td (${pdfText("Gráfico de barras - ocorrências registradas")}) Tj ET`);
    this.y = chartTop - 22;
    items.forEach((item) => {
      this.ensure(20);
      const width = Math.max(3, (item.quantity / max) * barWidth);
      const label = item.type.length > 31 ? `${item.type.slice(0, 30)}...` : item.type;
      this.current.lines.push(`BT /F1 8.5 Tf 0 0 0 rg ${this.margin} ${this.y + 3} Td (${pdfText(label)}) Tj ET`);
      this.current.lines.push(`q 0.90 0.94 0.97 rg ${this.margin + labelWidth} ${this.y} ${barWidth} 10 re f Q`);
      this.current.lines.push(`q 0.00 0.43 0.75 rg ${this.margin + labelWidth} ${this.y} ${width.toFixed(2)} 10 re f Q`);
      this.current.lines.push(`BT /F1 8.5 Tf 0 0 0 rg ${this.margin + labelWidth + barWidth + 8} ${this.y + 2} Td (${pdfText(String(item.quantity))}) Tj ET`);
      this.y -= 18;
    });
    this.y -= 8;
  }

  addFinalFooter() {
    this.ensure(78);
    const y = 24;
    this.current.lines.push(`q 0.95 0.42 0.06 rg ${this.margin} ${y + 44} ${this.contentWidth} 1.8 re f Q`);
    this.current.lines.push(`q 0.00 0.14 0.36 rg 190 ${y} 220 38 re f Q`);
    this.current.lines.push(`BT /F1 9 Tf 0.00 0.14 0.36 rg ${this.margin + 18} ${y + 17} Td (${pdfText("ANÁLISE DE RISCO")}) Tj ET`);
    this.current.lines.push(`BT /F1 9 Tf 1 1 1 rg 216 ${y + 22} Td (${pdfText("NM Engenharia e Consultoria")}) Tj ET`);
    this.current.lines.push(`BT /F1 8 Tf 1 1 1 rg 222 ${y + 10} Td (${pdfText("CNPJ 40.727.883/0001-50")}) Tj ET`);
    this.current.lines.push(`BT /F1 9 Tf 0.00 0.14 0.36 rg 456 ${y + 17} Td (${pdfText("SEGURANÇA EM ESTÁDIOS")}) Tj ET`);
  }

  toBlob() {
    const objects = [];
    const addObject = (body) => {
      objects.push(body);
      return objects.length;
    };

    const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const imageIds = new Map();
    this.images.forEach((image) => {
      const header = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`;
      const footer = "\nendstream";
      imageIds.set(image.name, addObject([asciiBytes(header), image.bytes, asciiBytes(footer)]));
    });

    const pageIds = [];
    const pagesId = objects.length + this.pages.length * 2 + 1;

    this.pages.forEach((page) => {
      const stream = `${page.lines.join("\n")}\n`;
      const contentId = addObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}endstream`);
      const xObjects = page.images.length
        ? `/XObject << ${page.images.map((image) => `/${image.name} ${imageIds.get(image.name)} 0 R`).join(" ")} >>`
        : "";
      const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 ${fontId} 0 R >> ${xObjects} >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    });

    addObject(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    const chunks = [asciiBytes("%PDF-1.4\n")];
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(totalLength(chunks));
      chunks.push(asciiBytes(`${index + 1} 0 obj\n`));
      if (Array.isArray(object)) chunks.push(...object);
      else chunks.push(asciiBytes(`${object}\n`));
      chunks.push(asciiBytes("endobj\n"));
    });

    const xrefOffset = totalLength(chunks);
    chunks.push(asciiBytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
    offsets.slice(1).forEach((offset) => {
      chunks.push(asciiBytes(`${String(offset).padStart(10, "0")} 00000 n \n`));
    });
    chunks.push(asciiBytes(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));

    return new Blob(chunks, { type: "application/pdf" });
  }
}

async function imageToJpeg(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpegData = canvas.toDataURL("image/jpeg", 0.82);
  return {
    bytes: base64ToBytes(jpegData.split(",")[1]),
    width: canvas.width,
    height: canvas.height,
  };
}

function wrapText(text, maxLength) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if ((line + " " + word).trim().length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}

function pdfText(value) {
  return String(value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–|—/g, "-")
    .split("")
    .map((char) => {
      if (char === "\\") return "\\\\";
      if (char === "(") return "\\(";
      if (char === ")") return "\\)";
      const code = winAnsiCode(char);
      if (code >= 32 && code <= 126) return char;
      if (code >= 128 && code <= 255) return `\\${code.toString(8).padStart(3, "0")}`;
      return "";
    })
    .join("");
}

function winAnsiCode(char) {
  const special = {
    "€": 128,
    "‚": 130,
    "ƒ": 131,
    "„": 132,
    "…": 133,
    "†": 134,
    "‡": 135,
    "ˆ": 136,
    "‰": 137,
    "Š": 138,
    "‹": 139,
    "Œ": 140,
    "Ž": 142,
    "•": 149,
    "™": 153,
    "š": 154,
    "›": 155,
    "œ": 156,
    "ž": 158,
    "Ÿ": 159,
  };
  return special[char] || char.charCodeAt(0);
}

function approximateTextWidth(text, fontSize) {
  const compact = String(text || "").replace(/\s+/g, " ");
  let units = 0;
  for (const char of compact) {
    if ("ilI.,' ".includes(char)) units += 240;
    else if ("MW@#".includes(char)) units += 820;
    else if (/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(char)) units += 650;
    else units += 510;
  }
  return (units / 1000) * fontSize;
}

function asciiBytes(value) {
  return new TextEncoder().encode(value);
}

function byteLength(value) {
  return asciiBytes(value).length;
}

function totalLength(chunks) {
  return chunks.reduce((sum, chunk) => sum + chunk.length, 0);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

init();
