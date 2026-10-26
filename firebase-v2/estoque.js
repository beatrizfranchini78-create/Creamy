```javascript
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  auth,
  db,
  verificarAcesso,
  sairDaConta
} from "./acesso.js";

const formulario = document.getElementById("formProduto");
const campoNome = document.getElementById("nomeProduto");
const campoCategoria = document.getElementById("categoriaProduto");
const campoQuantidade = document.getElementById("quantidadeProduto");
const campoPreco = document.getElementById("precoProduto");
const campoCusto = document.getElementById("custoProduto");
const listaProdutos = document.getElementById("listaProdutos");
const mensagem = document.getElementById("mensagemEstoque");
const botaoSalvar = document.getElementById("botaoSalvar");
const botaoCancelar = document.getElementById("botaoCancelar");
const botaoSair = document.getElementById("botaoSair");
const busca = document.getElementById("buscaProduto");
const filtroCategoria = document.getElementById("filtroCategoria");

let sorveteriaIdAtual = null;
let usuarioAtual = null;
let produtos = [];
let cancelarEscuta = null;
let produtoEditandoId = null;
let salvando = false;

function mostrarMensagem(texto, tipo = "info") {
  mensagem.textContent = texto;
  mensagem.dataset.tipo = tipo;
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function numeroValido(valor) {
  return Number.isFinite(valor) && valor >= 0;
}

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caractere]);
}

function obterCaminhoProdutos() {
  if (!sorveteriaIdAtual) {
    throw new Error("A sorveteria ainda não foi identificada.");
  }

  return collection(
    db,
    "Sorveterias",
    sorveteriaIdAtual,
    "produtos"
  );
}

function limparFormulario() {
  formulario.reset();
  produtoEditandoId = null;
  botaoSalvar.textContent = "Cadastrar produto";
  botaoCancelar.hidden = true;
}

function preencherFormulario(produto) {
  campoNome.value = produto.nome ?? "";
  campoCategoria.value = produto.categoria ?? "Sorvetes";
  campoQuantidade.value = produto.quantidade ?? 0;
  campoPreco.value = produto.preco ?? 0;
  campoCusto.value = produto.custo ?? 0;

  produtoEditandoId = produto.id;
  botaoSalvar.textContent = "Salvar alterações";
  botaoCancelar.hidden = false;

  formulario.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function desenharProdutos() {
  const termo = busca.value.trim().toLocaleLowerCase("pt-BR");
  const categoriaSelecionada = filtroCategoria.value;

  const filtrados = produtos.filter(produto => {
    const correspondeNome = String(produto.nome ?? "")
      .toLocaleLowerCase("pt-BR")
      .includes(termo);

    const correspondeCategoria =
      !categoriaSelecionada ||
      produto.categoria === categoriaSelecionada;

    return correspondeNome && correspondeCategoria;
  });

  if (filtrados.length === 0) {
    listaProdutos.innerHTML =
      '<p class="vazio">Nenhum produto encontrado.</p>';
    return;
  }

  listaProdutos.innerHTML = filtrados.map(produto => {
    const quantidade = Number(produto.quantidade) || 0;
    const ativo = produto.ativo !== false;

    let statusEstoque = "Disponível";
    if (!ativo) {
      statusEstoque = "Inativo";
    } else if (quantidade <= 0) {
      statusEstoque = "Sem estoque";
    } else if (quantidade <= 5) {
      statusEstoque = "Estoque baixo";
    }

    return `
      <article class="produto">
        <div class="produto-cabecalho">
          <div>
            <h3>${escaparHTML(produto.nome)}</h3>
            <p>${escaparHTML(produto.categoria || "Sem categoria")}</p>
          </div>
          <span class="status">${escaparHTML(statusEstoque)}</span>
        </div>

        <div class="dados-produto">
          <p>Quantidade: <strong>${quantidade}</strong></p>
          <p>Preço de venda: <strong>${formatarMoeda(produto.preco)}</strong></p>
          <p>Custo unitário: <strong>${formatarMoeda(produto.custo)}</strong></p>
        </div>

        <div class="acoes-produto">
          <button type="button" data-acao="editar"
            data-id="${escaparHTML(produto.id)}">
            Editar
          </button>

          <button type="button" data-acao="quantidade"
            data-id="${escaparHTML(produto.id)}">
            Ajustar estoque
          </button>

          <button type="button" data-acao="alternar"
            data-id="${escaparHTML(produto.id)}">
            ${ativo ? "Desativar" : "Reativar"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function atualizarFiltroCategorias() {
  const categoriaAtual = filtroCategoria.value;

  const categorias = [
    ...new Set(
      produtos
        .map(produto => produto.categoria)
        .filter(categoria => typeof categoria === "string" && categoria.trim())
    )
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  filtroCategoria.innerHTML =
    '<option value="">Todas as categorias</option>' +
    categorias.map(categoria =>
      `<option value="${escaparHTML(categoria)}">${escaparHTML(categoria)}</option>`
    ).join("");

  if (categorias.includes(categoriaAtual)) {
    filtroCategoria.value = categoriaAtual;
  }
}

async function salvarProduto(evento) {
  evento.preventDefault();

  if (salvando) return;

  if (!usuarioAtual || !sorveteriaIdAtual) {
    mostrarMensagem("Aguarde a validação do seu acesso.", "erro");
    return;
  }

  const nome = campoNome.value.trim();
  const categoria = campoCategoria.value.trim();
  const quantidade = Number(campoQuantidade.value);
  const preco = Number(campoPreco.value);
  const custo = Number(campoCusto.value);

  if (!nome || !categoria) {
    mostrarMensagem("Preencha o nome e a categoria.", "erro");
    return;
  }

  if (
    !Number.isInteger(quantidade) ||
    !numeroValido(quantidade) ||
    !numeroValido(preco) ||
    !numeroValido(custo)
  ) {
    mostrarMensagem(
      "Confira a quantidade, o preço e o custo. Os valores não podem ser negativos.",
      "erro"
    );
    return;
  }

  salvando = true;
  botaoSalvar.disabled = true;

  try {
    const dados = {
      nome,
      categoria,
      quantidade,
      preco,
      custo,
      atualizadoEm: serverTimestamp(),
      atualizadoPor: usuarioAtual.uid
    };

    if (produtoEditandoId) {
      const produto = produtos.find(
        item => item.id === produtoEditandoId
      );

      if (!produto) {
        throw new Error("O produto não foi encontrado. Atualize a página.");
      }

      await updateDoc(
        doc(
          db,
          "Sorveterias",
          sorveteriaIdAtual,
          "produtos",
          produtoEditandoId
        ),
        dados
      );

      mostrarMensagem("Produto atualizado com sucesso!", "sucesso");
    } else {
      await addDoc(obterCaminhoProdutos(), {
        ...dados,
        ativo: true,
        criadoEm: serverTimestamp(),
        criadoPor: usuarioAtual.uid
      });

      mostrarMensagem("Produto cadastrado com sucesso!", "sucesso");
    }

    limparFormulario();
  } catch (erro) {
    console.error("Erro ao salvar produto:", erro);
    mostrarMensagem(
      "Não foi possível salvar. Confira sua conexão e as regras de acesso do Firestore.",
      "erro"
    );
  } finally {
    salvando = false;
    botaoSalvar.disabled = false;
  }
}

async function ajustarQuantidade(produto) {
  const resposta = prompt(
    `Produto: ${produto.nome}\n` +
    `Estoque atual: ${produto.quantidade}\n\n` +
    "Digite a nova quantidade total:"
  );

  if (resposta === null) return;

  const novaQuantidade = Number(resposta);

  if (!Number.isInteger(novaQuantidade) || novaQuantidade < 0) {
    alert("Digite um número inteiro igual ou maior que zero.");
    return;
  }

  try {
    await updateDoc(
      doc(
        db,
        "Sorveterias",
        sorveteriaIdAtual,
        "produtos",
        produto.id
      ),
      {
        quantidade: novaQuantidade,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: usuarioAtual.uid
      }
    );

    mostrarMensagem("Estoque ajustado com sucesso!", "sucesso");
  } catch (erro) {
    console.error("Erro ao ajustar estoque:", erro);
    mostrarMensagem(
      "Não foi possível ajustar o estoque. Verifique as permissões.",
      "erro"
    );
  }
}

async function alternarProduto(produto) {
  const novoEstado = produto.ativo === false;

  const confirmacao = confirm(
    novoEstado
      ? `Deseja reativar "${produto.nome}"?`
      : `Deseja desativar "${produto.nome}"? O registro será mantido.`
  );

  if (!confirmacao) return;

  try {
    await updateDoc(
      doc(
        db,
        "Sorveterias",
        sorveteriaIdAtual,
        "produtos",
        produto.id
      ),
      {
        ativo: novoEstado,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: usuarioAtual.uid
      }
    );

    mostrarMensagem(
      novoEstado ? "Produto reativado." : "Produto desativado.",
      "sucesso"
    );
  } catch (erro) {
    console.error("Erro ao alterar produto:", erro);
    mostrarMensagem(
      "Não foi possível alterar o produto. Verifique as permissões.",
      "erro"
    );
  }
}

listaProdutos.addEventListener("click", async evento => {
  const botao = evento.target.closest("button[data-acao]");
  if (!botao) return;

  const produto = produtos.find(
    item => item.id === botao.dataset.id
  );

  if (!produto) return;

  if (botao.dataset.acao === "editar") {
    preencherFormulario(produto);
  } else if (botao.dataset.acao === "quantidade") {
    await ajustarQuantidade(produto);
  } else if (botao.dataset.acao === "alternar") {
    await alternarProduto(produto);
  }
});

formulario.addEventListener("submit", salvarProduto);

botaoCancelar.addEventListener("click", limparFormulario);
botaoSair.addEventListener("click", async () => {
  await sairDaConta();
});

busca.addEventListener("input", desenharProdutos);
filtroCategoria.addEventListener("change", desenharProdutos);

async function iniciarEstoque() {
  const acesso = await verificarAcesso(["dono", "estoque"]);

  // O usuário pode ter sido redirecionado para outra página.
  if (!acesso) return;

  usuarioAtual = acesso.usuario;
  sorveteriaIdAtual = acesso.sorveteriaId;

  mostrarMensagem("Conectando ao estoque compartilhado...", "info");

  try {
    const consulta = query(
      obterCaminhoProdutos(),
      orderBy("nome")
    );

    cancelarEscuta = onSnapshot(
      consulta,
      (snapshot) => {
        produtos = snapshot.docs.map(documento => ({
          id: documento.id,
          ...documento.data()
        }));

        atualizarFiltroCategorias();
        desenharProdutos();

        mostrarMensagem(
          "Estoque sincronizado. As alterações serão atualizadas nesta página em tempo real.",
          "sucesso"
        );
      },
      (erro) => {
        console.error("Erro ao carregar estoque:", erro);
        mostrarMensagem(
          "Não foi possível carregar o estoque. Confira as regras do Firestore e o identificador da sorveteria.",
          "erro"
        );
      }
    );
  } catch (erro) {
    console.error("Erro ao iniciar estoque:", erro);
    mostrarMensagem("Não foi possível iniciar o estoque.", "erro");
  }
}

window.addEventListener("beforeunload", () => {
  if (cancelarEscuta) cancelarEscuta();
});

iniciarEstoque();
```
