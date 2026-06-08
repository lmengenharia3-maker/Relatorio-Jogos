const checklistItems = [
  "Houve Reunião de Alinhamento",
  "Posto Médico e/ou Ambulâncias disponibilizadas",
  "BEPE autorizou a abertura dos portões no horário previsto",
  "Presença de alguma autoridade dos poderes (Gov/Pref/Pres. Tribunais)",
  "Portas das escadas N7 resguardadas com segurança",
  "Delegacia ativada para registro de ocorrências",
  "Saídas de emergência desobstruídas (escadas)",
  "Houve controle dos materiais da organizada pela PM",
  "Houve alguma ocorrência registrada nos estacionamentos",
  "Houve presença de ambulantes, catadores de latas/garrafas no EDG",
  "Indicações de saída fixadas em local visível",
  "Bombeiros Militares presentes no evento",
  "Controle externo de garrafas de vidro pela autoridade responsável",
  "Os elevadores disponibilizados estão em funcionamento pleno",
  "Ações do ECB gerou algum impacto/incidente durante o jogo",
  "Revista pessoal sendo apoiada pela Polícia Militar retaguarda",
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

  preview.innerHTML = `
    <header class="report-header">
      <p class="eyebrow">NM Consultoria e Gestão</p>
      <h2>Relatório de Evento ${valueOrDash(f.numeroRelatorio)}</h2>
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
      <h3>Informações adicionais</h3>
      <p>${escapeHtml(f.informacoesAdicionais || "—").replaceAll("\n", "<br />")}</p>
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

  pdf.addTitle("NM CONSULTORIA E GESTAO");
  pdf.addHeading(`Relatorio de Evento ${plain(f.numeroRelatorio || "")}`);
  pdf.addLine(`Tipo Evento: ${plain(f.tipoEvento || "futebolistico")}`);
  pdf.addLine(`Equipes: ${plain(f.equipes || "-")}`);
  pdf.addLine(`Data do Evento: ${formatDate(f.dataEvento)}    Horario: ${plain(f.horario || "-")}`);
  pdf.addLine(`Local do Evento: ${plain(f.localEvento || "-")}`);
  pdf.addLine(`Area de interesse: ${plain(f.areaInteresse || "-")}`);
  pdf.addLine(`Capacidade: ${plain(f.capacidade || "-")}    Expectativa: ${plain(f.expectativaPublico || "-")}    Publico: ${plain(f.quantidadePublico || "-")}`);
  pdf.addLine(`Abertura dos portoes: ${plain(f.aberturaPortoes || "-")}    Bordero: ${plain(f.bordero || "-")}`);

  pdf.addSection("2. INFORMACOES");
  data.checks.forEach((item) => {
    pdf.addWrapped(`${plain(item.question)}: ${plain(item.status || "-")}`, 10);
  });

  pdf.addSection("3. INFORMACOES ADICIONAIS");
  pdf.addWrapped(plain(f.informacoesAdicionais || "-"));

  pdf.addSection("ANEXO - DADOS ESTRATIFICADOS");
  data.kpis.forEach((item) => {
    if (!item.quantity && !item.sector && !item.note) return;
    pdf.addWrapped(`${plain(item.type)} | Qtd: ${item.quantity || 0} | Setor: ${plain(item.sector || "-")} | Obs: ${plain(item.note || "-")}`, 10);
  });

  if (data.photos.length) {
    pdf.addSection("RELATORIO FOTOGRAFICO");
    for (const photo of data.photos) {
      const jpeg = await imageToJpeg(photo.dataUrl);
      pdf.addImage(jpeg.bytes, jpeg.width, jpeg.height, plain(photo.caption || photo.name));
    }
  }

  return pdf.toBlob();
}

class SimplePdf {
  constructor() {
    this.width = 595.28;
    this.height = 841.89;
    this.margin = 42;
    this.pages = [];
    this.images = [];
    this.newPage();
  }

  newPage() {
    this.current = { lines: [], images: [] };
    this.pages.push(this.current);
    this.y = this.height - this.margin;
  }

  ensure(space) {
    if (this.y - space < this.margin) this.newPage();
  }

  addTitle(text) {
    this.ensure(34);
    this.current.lines.push(`BT /F1 13 Tf 0.06 0.25 0.18 rg ${this.margin} ${this.y} Td (${pdfEscape(text)}) Tj ET`);
    this.y -= 22;
  }

  addHeading(text) {
    this.ensure(36);
    this.current.lines.push(`BT /F1 18 Tf 0.05 0.16 0.11 rg ${this.margin} ${this.y} Td (${pdfEscape(text)}) Tj ET`);
    this.y -= 30;
  }

  addSection(text) {
    this.ensure(34);
    this.y -= 8;
    this.current.lines.push(`BT /F1 12 Tf 0.05 0.16 0.11 rg ${this.margin} ${this.y} Td (${pdfEscape(text)}) Tj ET`);
    this.y -= 20;
  }

  addLine(text) {
    this.ensure(18);
    this.current.lines.push(`BT /F1 10 Tf 0 0 0 rg ${this.margin} ${this.y} Td (${pdfEscape(plain(text))}) Tj ET`);
    this.y -= 15;
  }

  addWrapped(text, indent = 0) {
    const max = indent ? 88 : 96;
    wrapText(text, max).forEach((line) => {
      this.ensure(16);
      this.current.lines.push(`BT /F1 9.5 Tf 0 0 0 rg ${this.margin + indent} ${this.y} Td (${pdfEscape(plain(line))}) Tj ET`);
      this.y -= 14;
    });
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

  toBlob() {
    const objects = [];
    const addObject = (body) => {
      objects.push(body);
      return objects.length;
    };

    const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
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

function plain(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "");
}

function pdfEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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
