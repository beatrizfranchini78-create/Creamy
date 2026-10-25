const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { initializeApp, getApps } = require("firebase-admin/app");

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

exports.verificarMigracaoCreamy = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Faça login antes de verificar a migração."
    );
  }

  const cargo = request.auth.token.cargo;
  const sorveteriaId = request.auth.token.sorveteriaId;

  if (cargo !== "dono" || !sorveteriaId) {
    throw new HttpsError(
      "permission-denied",
      "Somente o dono pode verificar a migração."
    );
  }

  const uidAntigo = request.auth.uid;
  const origem = db.collection("usuarios").doc(uidAntigo);
  const destino = db.collection("Sorveterias").doc(sorveteriaId);

  const nomes = ["produtos", "vendas", "retiradas"];
  const resultado = {};

  for (const nome of nomes) {
    const [antigos, novos] = await Promise.all([
      origem.collection(nome).get(),
      destino.collection(nome).get()
    ]);

    resultado[nome] = {
      quantidadeAntiga: antigos.size,
      quantidadeNova: novos.size
    };
  }

  const personalizacaoAntiga = await origem
    .collection("configuracoes")
    .doc("personalizacao")
    .get();

  const personalizacaoNova = await destino
    .collection("configuracoes")
    .doc("personalizacao")
    .get();

  resultado.personalizacao = {
    existeAntiga: personalizacaoAntiga.exists,
    existeNova: personalizacaoNova.exists
  };

  return {
    sucesso: true,
    sorveteriaId,
    uidAntigo,
    resultado
  };
});


const { getAuth } = require("firebase-admin/auth");

exports.criarFuncionario = onCall(
  {
    region: "southamerica-east1",
    enforceAppCheck: false
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Você precisa entrar na conta do proprietário."
      );
    }

    const claims = request.auth.token;

    if (
      claims.cargo !== "dono" ||
      typeof claims.sorveteriaId !== "string" ||
      !claims.sorveteriaId
    ) {
      throw new HttpsError(
        "permission-denied",
        "Somente o proprietário pode criar funcionários."
      );
    }

    const dados = request.data || {};
    const email =
      typeof dados.email === "string"
        ? dados.email.trim().toLowerCase()
        : "";

    const senha =
      typeof dados.senha === "string"
        ? dados.senha
        : "";

    const cargo = dados.cargo;

    const cargosPermitidos = [
      "estoque",
      "vendas",
      "cozinha"
    ];

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Informe um e-mail válido."
      );
    }

    if (senha.length < 12 || senha.length > 128) {
      throw new HttpsError(
        "invalid-argument",
        "Use uma senha temporária com pelo menos 12 caracteres."
      );
    }

    if (!cargosPermitidos.includes(cargo)) {
      throw new HttpsError(
        "invalid-argument",
        "Escolha um cargo de funcionário válido."
      );
    }

    let usuarioCriado = null;

    try {
      usuarioCriado = await getAuth().createUser({
        email,
        password: senha,
        emailVerified: false,
        disabled: false
      });

      await getAuth().setCustomUserClaims(
        usuarioCriado.uid,
        {
          cargo,
          sorveteriaId: claims.sorveteriaId
        }
      );

      const referencia = db
        .collection("Sorveterias")
        .doc(claims.sorveteriaId)
        .collection("funcionarios")
        .doc(usuarioCriado.uid);

      await referencia.set({
        uid: usuarioCriado.uid,
        email,
        cargo,
        ativo: true,
        criadoPor: request.auth.uid,
        criadoEm: FieldValue.serverTimestamp()
      });

      return {
        sucesso: true,
        uid: usuarioCriado.uid,
        email,
        cargo
      };
    } catch (erro) {
      console.error("Erro ao criar funcionário:", erro);

      // Evita deixar uma conta criada sem o cadastro administrativo
      // quando ocorre uma falha durante a configuração inicial.
      if (usuarioCriado) {
        try {
          await getAuth().deleteUser(usuarioCriado.uid);
        } catch (erroExclusao) {
          console.error(
            "Não foi possível remover a conta incompleta:",
            erroExclusao
          );
        }
      }

      if (erro instanceof HttpsError) {
        throw erro;
      }

      if (erro.code === "auth/email-already-exists") {
        throw new HttpsError(
          "already-exists",
          "Já existe uma conta com esse e-mail."
        );
      }

      throw new HttpsError(
        "internal",
        "Não foi possível criar o funcionário."
      );
    }
  }
);

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();

const CARGOS_PERMITIDOS = new Set(['estoque', 'vendas', 'cozinha']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.criarFuncionario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Faça login como proprietário.');
  }

  const { sorveteriaId, nome, email, senha, cargo } = request.data || {};
  if (typeof sorveteriaId !== 'string' || !/^[a-zA-Z0-9_-]{3,80}$/.test(sorveteriaId)) {
    throw new HttpsError('invalid-argument', 'Código da sorveteria inválido.');
  }
  if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 100) {
    throw new HttpsError('invalid-argument', 'Informe o nome do funcionário.');
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
    throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');
  }
  if (typeof senha !== 'string' || senha.length < 8) {
    throw new HttpsError('invalid-argument', 'A senha inicial deve ter pelo menos 8 caracteres.');
  }
  if (!CARGOS_PERMITIDOS.has(cargo)) {
    throw new HttpsError('invalid-argument', 'Cargo inválido. Use estoque, vendas ou cozinha.');
  }

  const donoRef = db.doc(`Sorveterias/${sorveteriaId}/funcionarios/${request.auth.uid}`);
  const donoSnap = await donoRef.get();
  if (!donoSnap.exists || donoSnap.data().cargo !== 'dono' || donoSnap.data().ativo !== true) {
    throw new HttpsError('permission-denied', 'Somente o proprietário ativo pode criar funcionários.');
  }

  let novoUsuario;
  try {
    novoUsuario = await auth.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      displayName: nome.trim(),
      disabled: false
    });

    await db.doc(`Sorveterias/${sorveteriaId}/funcionarios/${novoUsuario.uid}`).create({
      uid: novoUsuario.uid,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      cargo,
      ativo: true,
      criadoPor: request.auth.uid,
      criadoEm: FieldValue.serverTimestamp()
    });

    await db.doc(`usuarios/${novoUsuario.uid}`).set({
      email: email.trim().toLowerCase(),
      nome: nome.trim(),
      sorveteriaId,
      cargo,
      dataCriacao: new Date().toISOString().slice(0, 10),
      criadoEm: FieldValue.serverTimestamp()
    });

    return { sucesso: true, uid: novoUsuario.uid, email: email.trim().toLowerCase(), cargo };
  } catch (erro) {
    if (novoUsuario?.uid) {
      await auth.deleteUser(novoUsuario.uid).catch(() => {});
      await db.doc(`Sorveterias/${sorveteriaId}/funcionarios/${novoUsuario.uid}`).delete().catch(() => {});
      await db.doc(`usuarios/${novoUsuario.uid}`).delete().catch(() => {});
    }
    if (erro instanceof HttpsError) throw erro;
    if (erro.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Esse e-mail já possui uma conta.');
    }
    console.error('Erro ao criar funcionário:', erro);
    throw new HttpsError('internal', 'Não foi possível criar o funcionário. Confira os registros da função.');
  }
});

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const MODALIDADES = [
  "consumo_local",
  "retirada",
  "entrega"
];

const CARGOS_QUE_VENDEM = [
  "dono",
  "vendas",
  "cliente"
];


exports.criarPedido = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Faça login para realizar um pedido."
    );
  }

  const cargo = request.auth.token.cargo;
  const sorveteriaId = request.auth.token.sorveteriaId;

  if (
    !sorveteriaId ||
    !["dono", "vendas", "cliente"].includes(cargo)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Sua conta não pode realizar pedidos."
    );
  }

  const {
    itens,
    modalidade,
    nomeCliente,
    endereco,
    observacoes
  } = request.data || {};

  const modalidadesPermitidas = [
    "consumo_local",
    "retirada",
    "entrega"
  ];

  if (
    !Array.isArray(itens) ||
    itens.length === 0 ||
    itens.length > 50
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Adicione produtos válidos ao pedido."
    );
  }

  if (!modalidadesPermitidas.includes(modalidade)) {
    throw new HttpsError(
      "invalid-argument",
      "Escolha uma modalidade válida."
    );
  }

  if (
    typeof nomeCliente !== "string" ||
    nomeCliente.trim().length < 2 ||
    nomeCliente.trim().length > 100
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Informe um nome válido."
    );
  }

  if (
    modalidade === "entrega" &&
    (
      typeof endereco !== "string" ||
      endereco.trim().length < 5 ||
      endereco.trim().length > 300
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Informe um endereço válido para a entrega."
    );
  }

  if (
    typeof observacoes !== "string" ||
    observacoes.length > 500
  ) {
    throw new HttpsError(
      "invalid-argument",
      "As observações devem ter até 500 caracteres."
    );
  }

  // Agrupa produtos repetidos e valida as quantidades.
  const quantidades = new Map();

  for (const item of itens) {
    if (
      !item ||
      typeof item.produtoId !== "string" ||
      item.produtoId.length === 0 ||
      item.produtoId.length > 150 ||
      !Number.isSafeInteger(item.quantidade) ||
      item.quantidade < 1
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Um dos produtos ou quantidades é inválido."
      );
    }

    const totalAnterior = quantidades.get(item.produtoId) || 0;
    const novoTotal = totalAnterior + item.quantidade;

    if (!Number.isSafeInteger(novoTotal)) {
      throw new HttpsError(
        "invalid-argument",
        "Quantidade inválida."
      );
    }

    quantidades.set(item.produtoId, novoTotal);
  }

  const sorveteriaRef = db
    .collection("Sorveterias")
    .doc(sorveteriaId);

  const pedidoRef = sorveteriaRef
    .collection("pedidos")
    .doc();

  const resultado = await db.runTransaction(async (transacao) => {
    const itensValidados = [];
    let receita = 0;

    // Primeiro, todas as leituras; depois, as gravações.
    for (const [produtoId, quantidade] of quantidades) {
      const produtoRef = sorveteriaRef
        .collection("produtos")
        .doc(produtoId);

      const documento = await transacao.get(produtoRef);

      if (!documento.exists) {
        throw new HttpsError(
          "not-found",
          "Um dos produtos não foi encontrado."
        );
      }

      const produto = documento.data();
      const estoqueAtual = Number(produto.quantidade);
      const preco = Number(produto.preco);

      if (
        !Number.isSafeInteger(estoqueAtual) ||
        estoqueAtual < 0 ||
        !Number.isFinite(preco) ||
        preco < 0
      ) {
        throw new HttpsError(
          "failed-precondition",
          `Os dados de estoque ou preço de "${produto.nome || produtoId}" são inválidos.`
        );
      }

      if (estoqueAtual < quantidade) {
        throw new HttpsError(
          "failed-precondition",
          `Estoque insuficiente para "${produto.nome || produtoId}".`
        );
      }

      const subtotal = preco * quantidade;

      if (!Number.isFinite(subtotal)) {
        throw new HttpsError(
          "failed-precondition",
          "Não foi possível calcular o pedido."
        );
      }

      receita += subtotal;

      itensValidados.push({
        produtoId,
        nome: String(produto.nome || "Produto"),
        quantidade,
        precoUnitario: preco,
        subtotal
      });

      transacao.update(produtoRef, {
        quantidade: estoqueAtual - quantidade
      });
    }

    if (!Number.isFinite(receita)) {
      throw new HttpsError(
        "failed-precondition",
        "O total do pedido é inválido."
      );
    }

    transacao.set(pedidoRef, {
      clienteUid: request.auth.uid,
      clienteNome: nomeCliente.trim(),
      itens: itensValidados,
      modalidade,
      endereco: modalidade === "entrega"
        ? endereco.trim()
        : "",
      observacoes: observacoes.trim(),
      receita,
      status: "recebido",
      criadoEm: FieldValue.serverTimestamp()
    });

    return {
      pedidoId: pedidoRef.id,
      receita
    };
  });

  return {
    sucesso: true,
    pedidoId: resultado.pedidoId,
    receita: resultado.receita
  };
});



exports.atualizarStatusPedido = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Faça login para atualizar o pedido."
    );
  }

  const cargo = request.auth.token.cargo;
  const sorveteriaId = request.auth.token.sorveteriaId;

  if (
    !sorveteriaId ||
    !["dono", "vendas", "cozinha"].includes(cargo)
  ) {
    throw new HttpsError(
      "permission-denied",
      "Você não tem permissão para atualizar pedidos."
    );
  }

  const { pedidoId, novoStatus } = request.data || {};

  const statusPermitidos = {
    recebido: ["preparando"],
    preparando: ["pronto"],
    pronto: ["entregue", "retirado"]
  };

  if (
    typeof pedidoId !== "string" ||
    !Object.hasOwn(statusPermitidos, novoStatus)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Pedido ou status inválido."
    );
  }

  const pedidoRef = db
    .collection("Sorveterias")
    .doc(sorveteriaId)
    .collection("pedidos")
    .doc(pedidoId);

  await db.runTransaction(async (transacao) => {
    const pedido = await transacao.get(pedidoRef);

    if (!pedido.exists) {
      throw new HttpsError("not-found", "Pedido não encontrado.");
    }

    const statusAtual = pedido.data().status;

    if (!statusPermitidos[statusAtual]?.includes(novoStatus)) {
      throw new HttpsError(
        "failed-precondition",
        "Essa mudança de status não é permitida."
      );
    }

    transacao.update(pedidoRef, {
      status: novoStatus,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: request.auth.uid
    });
  });

  return { sucesso: true, pedidoId, novoStatus };
});
