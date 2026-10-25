
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  auth,
  db
} from "./acesso.js";

const mensagem = document.getElementById("mensagemCozinha");
const lista = document.getElementById("listaPedidos");
const botaoSair = document.getElementById("botaoSair");

let pararPedidos = null;
let usuarioValidado = false;

const statusPermitidos = {
  recebido: "Recebido",
  preparando: "Em preparo",
  pronto: "Pronto"
};

function mostrarMensagem(texto) {
  mensagem.textContent = texto;
}

function criarElemento(tag, texto, classe) {
  const elemento = document.createElement(tag);
  elemento.textContent = texto;

  if (classe) {
    elemento.className = classe;
  }

  return elemento;
}

function formatarData(valor) {
  if (!valor || typeof valor.toDate !== "function") {
    return "Horário não informado";
  }

  return valor.toDate().toLocaleString("pt-BR");
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

    botao.addEventListener("click", async () => {
      botao.disabled = true;

      try {
        await atualizarStatus(id, pedido.status, proximoStatus);
      } catch (erro) {
        console.error(erro);
        alert(
          "Não foi possível atualizar o pedido. " +
          "Confira sua permissão e tente novamente."
        );
      } finally {
        botao.disabled = false;
      }
    });

    controles.append(botao);
  });

  card.append(controles);
  return card;
}

async function atualizarStatus(id, statusAtual, novoStatus) {
  if (!usuarioValidado) {
    throw new Error("Usuário ainda não validado.");
  }

  const usuario = auth.currentUser;

  if (!usuario) {
    throw new Error("Sessão encerrada.");
  }

  // Atualização otimista não é usada: o Firestore confirma a gravação.
  const token = await usuario.getIdTokenResult(true);

  if (
    token.claims.cargo !== "cozinha" &&
    token.claims.cargo !== "dono"
  ) {
    throw new Error("Cargo sem permissão para atualizar pedidos.");
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      statusPermitidos,
      statusAtual
    ) ||
    !Object.prototype.hasOwnProperty.call(
      statusPermitidos,
      novoStatus
    )
  ) {
    throw new Error("Status inválido.");
  }

  const caminho = doc(
    db,
    "Sorveterias",
    token.claims.sorveteriaId,
    "pedidos",
    id
  );

  await updateDoc(caminho, {
    status: novoStatus,
    atualizadoEm: serverTimestamp()
  });
}

function ouvirPedidos(sorveteriaId) {
  if (pararPedidos) {
    pararPedidos();
  }

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
            "Nenhum pedido aguardando preparo.",
            "cozinha-aviso"
          )
        );
        return;
      }

      pedidosAtivos.forEach((registro) => {
        lista.append(
          montarPedido(registro.id, registro.data())
        );
      });

      mostrarMensagem(
        `${pedidosAtivos.length} pedido(s) aguardando preparo ou em preparo.`
      );
    },
    (erro) => {
      console.error("Erro ao acompanhar pedidos:", erro);
      mostrarMensagem(
        "Não foi possível carregar os pedidos. Verifique as permissões do Firebase."
      );
    }
  );
}

onAuthStateChanged(auth, async (usuario) => {
  usuarioValidado = false;

  if (pararPedidos) {
    pararPedidos();
    pararPedidos = null;
  }

  if (!usuario) {
    window.location.replace("./index.html");
    return;
  }

  try {
    const token = await usuario.getIdTokenResult(true);
    const cargo = token.claims.cargo;
    const sorveteriaId = token.claims.sorveteriaId;

    if (
      !["cozinha", "dono"].includes(cargo) ||
      typeof sorveteriaId !== "string" ||
      !sorveteriaId
    ) {
      mostrarMensagem("Sua conta não tem acesso à cozinha.");
      await signOut(auth);
      window.location.replace("./index.html");
      return;
    }

    usuarioValidado = true;
    ouvirPedidos(sorveteriaId);
  } catch (erro) {
    console.error(erro);
    mostrarMensagem(
      "Não foi possível validar sua conta. Entre em contato com o proprietário."
    );
  }
});

botaoSair.addEventListener("click", async () => {
  if (pararPedidos) {
    pararPedidos();
  }

  await signOut(auth);
  window.location.replace("./index.html");
});
