# Relatório de Jogos

Aplicação estática para preencher o modelo `Modelo de Relatorio Jogos.xlsx` no navegador e baixar o relatório em PDF.

## Como usar localmente

Abra `index.html` no navegador ou rode um servidor local:

```bash
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Deploy no Render

1. Suba este diretório para um repositório no GitHub.
2. No Render, crie um novo **Static Site**.
3. Conecte o repositório.
4. Use:
   - Build Command: vazio
   - Publish Directory: `.`

O arquivo `render.yaml` já deixa essa configuração documentada para deploy por blueprint.
