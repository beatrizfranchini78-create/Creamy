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

exports.criarPedido = onCall(
  {
    region: "southamerica-east1",
    enforceAppCheck: false
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Entre na sua conta antes de fazer um pedido."
      );
    }

    const claims = request.auth.token;
    const cargo = claims.cargo;
    const sorveteriaId = claims.sorveteriaId;

    if (
      !CARGOS_QUE_VENDEM.includes(cargo) ||
      typeof sorveteriaId !== "string" ||
      !sorveteriaId
    ) {
      throw new HttpsError(
        "permission-denied",
        "Sua conta não tem permissão para fazer pedidos."
      );
    }

    const dados = request.data || {};
    const modalidade = dados.modalidade;
    const itensRecebidos = dados.itens;

    if (!MODALIDADES.includes(modalidade)) {
      throw new HttpsError(
        "invalid-argument",
        "Escolha consumo local, retirada ou entrega."
      );
    }

    if (
      !Array.isArray(itensRecebidos) ||
      itensRecebidos.length === 0 ||
      itensRecebidos.length > 50
    ) {
      throw new HttpsError(
        "invalid-argument",
        "O pedido precisa ter entre 1 e 50 itens."
      );
    }

    const quantidadesPorProduto = new Map();

    for (const item of itensRecebidos) {
      if (
        !item ||
        typeof item.produtoId !== "string" ||
        !item.produtoId ||
        !Number.isSafeInteger(item.quantidade) ||
        item.quantidade <= 0
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Um dos produtos ou quantidades é inválido."
        );
      }

      const anterior =
        quantidadesPorProduto.get(item.produtoId) || 0;

      const total = anterior + item.quantidade;

      if (!Number.isSafeInteger(total) || total > 10000) {
        throw new HttpsError(
          "invalid-argument",
          "A quantidade solicitada é muito alta."
        );
      }

      quantidadesPorProduto.set(item.produtoId, total);
    }

    const pedidosRef = db
      .collection("Sorveterias")
      .doc(sorveteriaId)
      .collection("pedidos");

    const produtosRef = db
      .collection("Sorveterias")
      .doc(sorveteriaId)
      .collection("produtos");

    const novoPedidoRef = pedidosRef.doc();

    const nomeCliente =
      typeof dados.nomeCliente === "string"
        ? dados.nomeCliente.trim().slice(0, 100)
        : "";

    const observacoes =
      typeof dados.observacoes === "string"
        ? dados.observacoes.trim().slice(0, 500)
        : "";

    const endereco =
      modalidade === "entrega" &&
      typeof dados.endereco === "string"
        ? dados.endereco.trim().slice(0, 300)
        : "";

    if (modalidade === "entrega" && !endereco) {
      throw new HttpsError(
        "invalid-argument",
        "Informe o endereço para entrega."
      );
    }

    try {
      const resultado = await db.runTransaction(
        async (transaction) => {
          const referencias = Array.from(
            quantidadesPorProduto.keys()
          ).map((id) => produtosRef.doc(id));

          // Ler todos os documentos antes de escrever.
          const documentos = [];

          for (const referencia of referencias) {
            documentos.push(
              await transaction.get(referencia)
            );
          }

          const itensConfirmados = [];
          let total = 0;

          for (let i = 0; i < documentos.length; i++) {
            const documento = documentos[i];
            const produtoId = Array.from(
              quantidadesPorProduto.keys()
            )[i];

            const quantidade =
              quantidadesPorProduto.get(produtoId);

            if (!documento.exists) {
              throw new HttpsError(
                "not-found",
                "Um dos produtos não foi encontrado."
              );
            }

            const produto = documento.data();

            if (
              produto.ativo === false ||
              !Number.isFinite(Number(produto.quantidade)) ||
              !Number.isFinite(Number(produto.preco)) ||
              Number(produto.preco) < 0
            ) {
              throw new HttpsError(
                "failed-precondition",
                `O produto ${produto.nome || produtoId} não está disponível.`
              );
            }

            if (Number(produto.quantidade) < quantidade) {
              throw new HttpsError(
                "failed-precondition",
                `Estoque insuficiente para ${produto.nome || produtoId}.`
              );
            }

            const preco = Number(produto.preco);
            const subtotal = preco * quantidade;

            if (!Number.isFinite(subtotal)) {
              throw new HttpsError(
                "invalid-argument",
                "O valor de um item é inválido."
              );
            }

            total += subtotal;

            itensConfirmados.push({
              produtoId,
              nome: String(produto.nome || "Produto"),
              quantidade,
              unidade: String(produto.unidade || "un."),
              preco,
              subtotal
            });
          }

          if (!Number.isFinite(total)) {
            throw new HttpsError(
              "invalid-argument",
              "Não foi possível calcular o total."
            );
          }

          // Desconta o estoque e registra o pedido juntos.
          for (let i = 0; i < documentos.length; i++) {
            const produto = documentos[i].data();
            const produtoId = Array.from(
              quantidadesPorProduto.keys()
            )[i];

            transaction.update(referencias[i], {
              quantidade:
                Number(produto.quantidade) -
                quantidadesPorProduto.get(produtoId)
            });
          }

          transaction.set(novoPedidoRef, {
            clienteUid: request.auth.uid,
            nomeCliente,
            modalidade,
            endereco,
            observacoes,
            itens: itensConfirmados,
            total: Number(total.toFixed(2)),
            status: "recebido",
            criadoEm: FieldValue.serverTimestamp(),
            atualizadoEm: FieldValue.serverTimestamp()
          });

          return {
            pedidoId: novoPedidoRef.id,
            total: Number(total.toFixed(2))
          };
        }
      );

      return {
        sucesso: true,
        pedidoId: resultado.pedidoId,
        total: resultado.total
      };
    } catch (erro) {
      if (erro instanceof HttpsError) {
        throw erro;
      }

      console.error("Falha ao criar pedido:", erro);

      throw new HttpsError(
        "internal",
        "Não foi possível registrar o pedido. Tente novamente."
      );
    }
  }
);
