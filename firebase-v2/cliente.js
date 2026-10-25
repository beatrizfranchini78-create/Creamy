
import {
  auth,
  db,
  functions,
  httpsCallable,
  verificarAcesso,
  sairDaConta
} from "./acesso.js";

import {
  collection,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const cardapio = document.getElementById("cardapio");
const carrinhoElemento = document.getElementById("carrinho");
const totalElemento = document.getElementById("totalCarrinho");
const modalidadeElemento = document.getElementById("modalidade");
const nomeElemento = document.getElementById("nomeCliente");
const enderecoElemento = document.getElementById("enderecoCliente");
const observacoesElemento = document.getElementById("observacoes");
const finalizarBotao = document.getElementById("finalizarPedido");
const pedidosElemento = document.getElementById("meusPedidos");

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

let acesso = null;
let produtos = [];
let carrinho = [];
let cancelarProdutos = null;
let cancelarPedidos = null;

function mostrarMensagem(elemento, mensagem) {
  elemento.textContent = mensagem;
}

function desenharCardapio() {
  cardapio.replaceChildren();

  if (!produtos.length) {
    mostrarMensagem(cardapio, "Nenhum produto disponível no momento.");
    return;
  }

  produtos.forEach((produto) => {
    const quantidadeDisponivel = Number(produto.quantidade || 0);

    const card = document.createElement("article");
    card.className = "card-resumo";

    const titulo = document.createElement("h3");
    titulo.textContent = produto.nome || "Produto";

    const preco = document.createElement("p");
    preco.textContent = moeda.format(Number(produto.preco || 0));

    const disponibilidade = document.createElement("p");
    disponibilidade.textContent = quantidadeDisponivel > 0
      ? "Disponível"
      : "Indisponível";

    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Adicionar ao carrinho";
    botao.disabled = quantidadeDisponivel <= 0;

    botao.addEventListener("click", () => {
      adicionarAoCarrinho(produto.id);
    });

    card.append(titulo, preco, disponibilidade, botao);
    cardapio.appendChild(card);
  });
}

function adicionarAoCarrinho(produtoId) {
  const produto = produtos.find((p) => p.id === produtoId);

  if (!produto || Number(produto.quantidade || 0) <= 0) {
    alert("Esse produto não está disponível.");
    return;
  }

  const item = carrinho.find((p) => p.produtoId === produtoId);
  const quantidadeAtual = item ? item.quantidade : 0;

  if (quantidadeAtual >= Number(produto.quantidade)) {
    alert("Você chegou ao limite disponível desse produto.");
    return;
  }

  if (item) {
    item.quantidade += 1;
  } else {
    carrinho.push({
      produtoId,
      nome: produto.nome,
      preco: Number(produto.preco || 0),
      quantidade: 1
    });
  }

  desenharCarrinho();
}

function desenharCarrinho() {
  carrinhoElemento.replaceChildren();

  if (!carrinho.length) {
    mostrarMensagem(carrinhoElemento, "Seu carrinho está vazio.");
    totalElemento.textContent = moeda.format(0);
    return;
  }

  let total = 0;

  carrinho.forEach((item) => {
    const subtotal = item.preco * item.quantidade;
    total += subtotal;

    const linha = document.createElement("div");
    linha.className = "item-carrinho";

    const descricao = document.createElement("p");
    descricao.textContent =
      `${item.nome} — ${item.quantidade} unidade(s) — ${moeda.format(subtotal)}`;

    const remover = document.createElement("button");
    remover.type = "button";
    remover.textContent = "Remover uma unidade";

    remover.addEventListener("click", () => {
      item.quantidade -= 1;

      if (item.quantidade <= 0) {
        carrinho = carrinho.filter(
          (p) => p.produtoId !== item.produtoId
        );
      }

      desenharCarrinho();
    });

    linha.append(descricao, remover);
    carrinhoElemento.appendChild(linha);
  });

  totalElemento.textContent = moeda.format(total);
}

async function finalizarPedido() {
  if (!acesso) {
    alert("Não foi possível confirmar seu acesso.");
    return;
  }

  if (!carrinho.length) {
    alert("Adicione pelo menos um produto ao carrinho.");
    return;
  }

  const nomeCliente = nomeElemento.value.trim();
  const modalidade = modalidadeElemento.value;
  const endereco = enderecoElemento.value.trim();
  const observacoes = observacoesElemento.value.trim();

  if (!nomeCliente) {
    alert("Digite seu nome.");
    nomeElemento.focus();
    return;
  }

  if (
    modalidade === "entrega" &&
    !endereco
  ) {
    alert("Digite o endereço para entrega.");
    enderecoElemento.focus();
    return;
  }

  finalizarBotao.disabled = true;
  finalizarBotao.textContent = "Enviando pedido...";

  try {
    const criarPedido = httpsCallable(functions, "criarPedido");

    const resposta = await criarPedido({
      itens: carrinho.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade
      })),
      modalidade,
      nomeCliente,
      endereco: modalidade === "entrega" ? endereco : "",
      observacoes
    });

    carrinho = [];
    desenharCarrinho();

    alert("Pedido enviado! A cozinha poderá recebê-lo após a integração do servidor.");

    console.log("Resposta da criação do pedido:", resposta.data);
  } catch (erro) {
    console.error("Erro ao enviar pedido:", erro);

    alert(
      "Não foi possível enviar o pedido. " +
      "Confira sua conexão e as configurações do Firebase."
    );
  } finally {
    finalizarBotao.disabled = false;
    finalizarBotao.textContent = "Finalizar pedido";
  }
}

function acompanharMeusPedidos(uid) {
  if (cancelarPedidos) {
    cancelarPedidos();
    cancelarPedidos = null;
  }

  const pedidosRef = collection(
    db,
    "Sorveterias",
    acesso.sorveteriaId,
    "pedidos"
  );

  const consulta = query(
    pedidosRef,
    where("clienteUid", "==", uid)
  );

  cancelarPedidos = onSnapshot(
    consulta,
    (snapshot) => {
      pedidosElemento.replaceChildren();

      if (snapshot.empty) {
        mostrarMensagem(
          pedidosElemento,
          "Você ainda não tem pedidos."
        );
        return;
      }

      snapshot.forEach((documento) => {
        const pedido = documento.data();
        const bloco = document.createElement("article");
        bloco.className = "card-resumo";

        const titulo = document.createElement("h3");
        titulo.textContent = `Pedido ${documento.id}`;

        const status = document.createElement("p");
        status.textContent = `Status: ${pedido.status || "Recebido"}`;

        const modalidade = document.createElement("p");
        modalidade.textContent =
          `Modalidade: ${pedido.modalidade || "Não informada"}`;

        bloco.append(titulo, status, modalidade);
        pedidosElemento.appendChild(bloco);
      });
    },
    (erro) => {
      console.error("Erro ao acompanhar pedidos:", erro);
      mostrarMensagem(
        pedidosElemento,
        "Não foi possível carregar seus pedidos."
      );
    }
  );
}

async function iniciar() {
  acesso = await verificarAcesso(["cliente"]);

  if (!acesso) return;

  const produtosRef = collection(
    db,
    "Sorveterias",
    acesso.sorveteriaId,
    "produtos"
  );

  cancelarProdutos = onSnapshot(
    produtosRef,
    (snapshot) => {
      produtos = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data()
      }));

      desenharCardapio();
    },
    (erro) => {
      console.error("Erro ao carregar cardápio:", erro);
      mostrarMensagem(cardapio, "Erro ao carregar os produtos.");
    }
  );

  acompanharMeusPedidos(acesso.usuario.uid);
}

finalizarBotao.addEventListener("click", finalizarPedido);

iniciar().catch((erro) => {
  console.error("Erro ao iniciar a área do cliente:", erro);
});

window.addEventListener("pagehide", () => {
  if (cancelarProdutos) cancelarProdutos();
  if (cancelarPedidos) cancelarPedidos();
});
