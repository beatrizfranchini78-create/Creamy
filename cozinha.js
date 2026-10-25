
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  auth,
  db,
  functions,
  httpsCallable,
  verificarAcesso,
  sairDaConta
} from "./acesso.js";

const mensagem = document.getElementById("mensagemCozinha");
const lista = document.getElementById("listaPedidos");
const botaoSair = document.getElementById("botaoSair");

let pararPedidos = null;
let usuarioValidado = false;
let acessoAtual = null;

const statusPermitidos = {
  recebido: "Recebido",
  preparando: "Em preparo",
  pronto: "Pronto"
};

function mostrarMensagem(texto) {
  if (mensagem) mensagem.textContent = texto;
}

function criarElemento(tag, texto, classe) {
  const elemento = document.createElement(tag);
  elemento.textContent = texto;

  if (classe) elemento.className = classe;

  return elemento;
}

function formatarData(valor) {
  if (!valor) return "Horário não informado";

  if (typeof valor.toDate === "function") {
    return valor.toDate().toLocaleString("pt-BR");
  }

  return "Horário não informado";
}

async function mudarStatus(pedidoId, novoStatus, botao) {
  if (!usuarioValidado || !acessoAtual) {
    alert("Sua sessão ainda não foi validada.");
    return;
  }

  if (botao) botao.disabled = true;

  try {
    const atualizarStatusPedido = httpsCallable(
      functions,
      "atualizarStatusPedido"
    );

    await atualizarStatusPedido({
      pedidoId,
      novoStatus
    });
  } catch (erro) {
    console.error("Erro ao atualizar pedido:", erro);

    alert(
      "Não foi possível atualizar o pedido. " +
      "Verifique sua conexão, suas permissões e se a função foi publicada."
    );
  } finally {
    if (botao) botao.disabled = false;
  }
}

function montarPedido(id, pedido) {
  const card = document.createElement("article");
  card.className = "pedido-card";

  const numero = pedido.numero || id.slice(0, 8);

  card.append(
    criarElemento("h2", `Pedido ${numero}`),
    criarElemento(
      "p",
      `Situação: ${statusPermitidos[pedido.status] || "Indefinida"}`,
      "pedido-status"
    ),
    criarElemento(
      "p",
      `Modalidade: ${pedido.modalidade || "Não informada"}`
    ),
    criarElemento(
      "p",
      `Recebido: ${formatarData(pedido.criadoEm)}`
    )
  );

  if (pedido.clienteNome) {
    card.append(
      criarElemento("p", `Cliente: ${pedido.clienteNome}`)
    );
  }

  if (pedido.observacoes) {
    card.append(
      criarElemento("p", `Observações: ${pedido.observacoes}`)
    );
  }

  const itens = document.createElement("ul");
  itens.className = "pedido-itens";

  if (Array.isArray(pedido.itens)) {
    pedido.itens.forEach((item) => {
      const nome = String(item.nome || item.produto || "Produto");
      const quantidade = Number(item.quantidade || 0);

      itens.append(
        criarElemento("li", `${quantidade} × ${nome}`)
      );
    });
  }

  card.append(itens);

  const controles = document.createElement("div");
  controles.className = "pedido-cabecalho";

  const fluxo = {
    recebido: ["preparando"],
    preparando: ["pronto"],
    pronto: []
  };

  const proximos = fluxo[pedido.status] || [];

  proximos.forEach((proximoStatus) => {
    const botao = document.createElement("button");
    botao.type = "button";

    botao.textContent =
      proximoStatus === "preparando"
        ? "Iniciar preparo"
        : "Marcar como pronto";

    botao.addEventListener("click", () => {
      mudarStatus(id, proximoStatus, botao);
    });

    controles.append(botao);
  });

  card.append(controles);
  return card;
}

function ouvirPedidos(sorveteriaId) {
  if (pararPedidos) pararPedidos();

  const referencia = collection(
    db,
    "Sorveterias",
    sorveteriaId,
    "pedidos"
  );

  const consulta = query(
    referencia,
    orderBy("criadoEm", "asc")
  );

  pararPedidos = onSnapshot(
    consulta,
    (snapshot) => {
      lista.replaceChildren();

      const pedidosAtivos = snapshot.docs.filter((registro) => {
        const pedido = registro.data();

        return ["recebido", "preparando"].includes(pedido.status);
      });

      if (pedidosAtivos.length === 0) {
        lista.append(
          criarElemento(
            "p",
            "Nenhum pedido na fila de preparo.",
            "cozinha-aviso"
          )
        );

        mostrarMensagem("Não há pedidos ativos.");
        return;
      }

      pedidosAtivos.forEach((registro) => {
        lista.append(
          montarPedido(registro.id, registro.data())
        );
      });

      mostrarMensagem(
       `${pedidosAtivos.length} pedido(s) na fila de preparo.`
      );
    },
    (erro) => {
      console.error("Erro ao acompanhar pedidos:", erro);

      mostrarMensagem(
        "Não foi possível carregar os pedidos. " +
        "Verifique as permissões do Firebase."
      );
    }
  );
}

async function iniciarCozinha() {
  const acesso = await verificarAcesso(["cozinha", "dono"]);

  if (!acesso) return;

  acessoAtual = acesso;
  usuarioValidado = true;

  ouvirPedidos(acesso.sorveteriaId);
}

if (botaoSair) {
  botaoSair.addEventListener("click", async () => {
    usuarioValidado = false;

    if (pararPedidos) {
      pararPedidos();
      pararPedidos = null;
    }

    await sairDaConta();
  });
}

iniciarCozinha().catch((erro) => {
  console.error("Erro ao iniciar cozinha:", erro);
  mostrarMensagem("Não foi possível iniciar a cozinha.");
});

window.addEventListener("pagehide", () => {
  usuarioValidado = false;

  if (pararPedidos) {
    pararPedidos();
    pararPedidos = null;
  }
});
