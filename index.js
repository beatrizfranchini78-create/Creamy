# functions/index.js — Creamy

```javascript
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const {
  initializeApp,
  getApps
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

// =====================================================
// 1. INICIALIZAÇÃO DO FIREBASE
// =====================================================

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

const REGIAO = "southamerica-east1";

const CARGOS_FUNCIONARIOS = new Set([
  "estoque",
  "vendas",
  "cozinha"
]);

const MODALIDADES_PEDIDO = new Set([
  "consumo_local",
  "retirada",
  "entrega"
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// =====================================================
// 2. VERIFICAR A MIGRAÇÃO DOS DADOS ANTIGOS
// Esta função apenas conta documentos. Não copia,
// modifica nem apaga dados.
// =====================================================

exports.verificarMigracaoCreamy = onCall(
  { region: REGIAO },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Faça login para verificar a migração."
      );
    }

    const { cargo, sorveteriaId } = request.auth.token;

    if (
      cargo !== "dono" ||
      typeof sorveteriaId !== "string" ||
      !sorveteriaId
    ) {
      throw new HttpsError(
        "permission-denied",
        "Somente o proprietário pode verificar a migração."
      );
    }

    const uidAntigo = request.auth.uid;

    const origem = db
      .collection("usuarios")
      .doc(uidAntigo);

    const destino = db
      .collection("Sorveterias")
      .doc(sorveteriaId);

    const nomesColecoes = [
      "produtos",
      "vendas",
      "retiradas"
    ];

    const resultado = {};

    for (const nome of nomesColecoes) {
      const [antigos, novos] = await Promise.all([
        origem.collection(nome).get(),
        destino.collection(nome).get()
      ]);

      resultado[nome] = {
        quantidadeAntiga: antigos.size,
        quantidadeNova: novos.size
      };
    }

    const [personalizacaoAntiga, personalizacaoNova] =
      await Promise.all([
        origem
          .collection("configuracoes")
          .doc("personalizacao")
          .get(),

        destino
          .collection("configuracoes")
          .doc("personalizacao")
          .get()
      ]);

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
  }
);

// =====================================================
// 3. CRIAR FUNCIONÁRIO
// Somente uma conta com cargo "dono" pode chamar.
// O cargo e a sorveteria são obtidos do token validado,
// nunca do cargo enviado pelo navegador.
// =====================================================

exports.criarFuncionario = onCall(
  { region: REGIAO },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Entre na conta do proprietário."
      );
    }

    const claims = request.auth.token;
    const sorveteriaId = claims.sorveteriaId;

    if (
      claims.cargo !== "dono" ||
      typeof sorveteriaId !== "string" ||
      !sorveteriaId
    ) {
      throw new HttpsError(
        "permission-denied",
        "Somente o proprietário pode criar funcionários."
      );
    }

    const dados = request.data || {};

    const nome =
      typeof dados.nome === "string"
        ? dados.nome.trim()
        : "";

    const email =
      typeof dados.email === "string"
        ? dados.email.trim().toLowerCase()
        : "";

    const senha =
      typeof dados.senha === "string"
        ? dados.senha
        : "";

    const cargo = dados.cargo;

    if (nome.length < 2 || nome.length > 100) {
      throw new HttpsError(
        "invalid-argument",
        "Informe um nome entre 2 e 100 caracteres."
      );
    }

    if (
      !email ||
      email.length > 254 ||
      !EMAIL_RE.test(email)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Informe um e-mail válido."
      );
    }

    if (senha.length < 12 || senha.length > 128) {
      throw new HttpsError(
        "invalid-argument",
        "A senha inicial deve ter entre 12 e 128 caracteres."
      );
    }

    if (!CARGOS_FUNCIONARIOS.has(cargo)) {
      throw new HttpsError(
        "invalid-argument",
        "O cargo deve ser estoque, vendas ou cozinha."
      );
    }

    let novoUsuario = null;

    try {
      novoUsuario = await auth.createUser({
        email,
        password: senha,
        displayName: nome,
        emailVerified: false,
        disabled: false
      });

      await auth.setCustomUserClaims(novoUsuario.uid, {
        cargo,
        sorveteriaId
      });

      const funcionarioRef = db
        .collection("Sorveterias")
        .doc(sorveteriaId)
        .collection("funcionarios")
        .doc(novoUsuario.uid);

      await funcionarioRef.create({
        uid: novoUsuario.uid,
        nome,
        email,
        cargo,
        ativo: true,
        criadoPor: request.auth.uid,
        criadoEm: FieldValue.serverTimestamp()
      });

      await db
        .collection("usuarios")
        .doc(novoUsuario.uid)
        .set({
          uid: novoUsuario.uid,
          nome,
          email,
          cargo,
          sorveteriaId,
          criadoEm: FieldValue.serverTimestamp()
        });

      return {
        sucesso: true,
        uid: novoUsuario.uid,
        nome,
        email,
        cargo
      };
    } catch (erro) {
      console.error("Erro ao criar funcionário:", erro);

      if (novoUsuario) {
        try {
          await db
            .collection("Sorveterias")
            .doc(sorveteriaId)
            .collection("funcionarios")
            .doc(novoUsuario.uid)
            .delete();

          await db
            .collection("usuarios")
            .doc(novoUsuario.uid)
            .delete();

          await auth.deleteUser(novoUsuario.uid);
        } catch (erroLimpeza) {
          console.error(
            "Erro ao limpar cadastro incompleto:",
            erroLimpeza
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

// =====================================================
// 4. CRIAR PEDIDO E DESCONTAR O ESTOQUE
// O preço é consultado no Firestore, não no navegador.
// Todas as leituras da transação acontecem antes
// de qualquer gravação.
// =====================================================

exports.criarPedido = onCall(
  { region: REGIAO },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Faça login para realizar um pedido."
      );
    }

    const claims = request.auth.token;
    const cargo = claims.cargo;
    const sorveteriaId = claims.sorveteriaId;

    if (
      typeof sorveteriaId !== "string" ||
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

    if (
      !Array.isArray(itens) ||
      itens.length === 0 ||
      itens.length > 50
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Adicione entre 1 e 50 itens ao pedido."
      );
    }

    if (!MODALIDADES_PEDIDO.has(modalidade)) {
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

    const enderecoNormalizado =
      typeof endereco === "string" ? endereco.trim() : "";

    if (
      modalidade === "entrega" &&
      (
        enderecoNormalizado.length < 5 ||
        enderecoNormalizado.length > 300
      )
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Informe um endereço válido para a entrega."
      );
    }

    const observacoesNormalizadas =
      typeof observacoes === "string"
        ? observacoes.trim()
        : "";

    if (
      typeof observacoes !== "undefined" &&
      typeof observacoes !== "string"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "As observações são inválidas."
      );
    }

    if (observacoesNormalizadas.length > 500) {
      throw new HttpsError(
        "invalid-argument",
        "As observações podem ter até 500 caracteres."
      );
    }

    // Agrupar itens repetidos e validar quantidades.
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

      const anterior = quantidades.get(item.produtoId) || 0;
      const total = anterior + item.quantidade;

      if (!Number.isSafeInteger(total)) {
        throw new HttpsError(
          "invalid-argument",
          "A quantidade solicitada é inválida."
        );
      }

      quantidades.set(item.produtoId, total);
    }

    const sorveteriaRef = db
      .collection("Sorveterias")
      .doc(sorveteriaId);

    const pedidoRef = sorveteriaRef
      .collection("pedidos")
      .doc();

    const resultado = await db.runTransaction(
      async (transacao) => {
        const produtosLidos = [];

        // PRIMEIRA ETAPA: somente leituras.
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

          if (produto.ativo === false) {
            throw new HttpsError(
              "failed-precondition",
              `O produto "${produto.nome || produtoId}" está indisponível.`
            );
          }

          const estoqueAtual = produto.quantidade;
          const preco = produto.preco;

          if (
            !Number.isSafeInteger(estoqueAtual) ||
            estoqueAtual < 0 ||
            typeof preco !== "number" ||
            !Number.isFinite(preco) ||
            preco < 0
          ) {
            throw new HttpsError(
              "failed-precondition",
              `O estoque ou preço de "${produto.nome || produtoId}" é inválido.`
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
              "Não foi possível calcular o valor do pedido."
            );
          }

          produtosLidos.push({
            referencia: produtoRef,
            produtoId,
            nome: String(produto.nome || "Produto"),
            quantidade,
            estoqueAtual,
            preco,
            subtotal
          });
        }

        const receita = produtosLidos.reduce(
          (total, item) => total + item.subtotal,
          0
        );

        if (!Number.isFinite(receita)) {
          throw new HttpsError(
            "failed-precondition",
            "O total do pedido é inválido."
          );
        }

        const itensValidados = produtosLidos.map((item) => ({
          produtoId: item.produtoId,
          nome: item.nome,
          quantidade: item.quantidade,
          precoUnitario: item.preco,
          subtotal: item.subtotal
        }));

        // SEGUNDA ETAPA: somente gravações.
        for (const item of produtosLidos) {
          transacao.update(item.referencia, {
            quantidade: item.estoqueAtual - item.quantidade
          });
        }

        transacao.set(pedidoRef, {
          clienteUid: request.auth.uid,
          clienteNome: nomeCliente.trim(),
          itens: itensValidados,
          modalidade,
          endereco:
            modalidade === "entrega"
              ? enderecoNormalizado
              : "",
          observacoes: observacoesNormalizadas,
          receita,
          status: "recebido",
          criadoEm: FieldValue.serverTimestamp()
        });

        return {
          pedidoId: pedidoRef.id,
          receita
        };
      }
    );

    return {
      sucesso: true,
      pedidoId: resultado.pedidoId,
      receita: resultado.receita
    };
  }
);

// =====================================================
// 5. ATUALIZAR O STATUS DO PEDIDO
// A alteração ocorre no servidor e verifica o status
// atual para impedir transições fora da sequência.
// =====================================================

exports.atualizarStatusPedido = onCall(
  { region: REGIAO },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Faça login para atualizar o pedido."
      );
    }

    const claims = request.auth.token;
    const cargo = claims.cargo;
    const sorveteriaId = claims.sorveteriaId;

    if (
      typeof sorveteriaId !== "string" ||
      !sorveteriaId ||
      !["dono", "vendas", "cozinha"].includes(cargo)
    ) {
      throw new HttpsError(
        "permission-denied",
        "Você não tem permissão para atualizar pedidos."
      );
    }

    const { pedidoId, novoStatus } = request.data || {};

    const transicoes = {
      recebido: ["preparando"],
      preparando: ["pronto"],
      pronto: ["entregue", "retirado"]
    };

    if (
      typeof pedidoId !== "string" ||
      pedidoId.length === 0 ||
      pedidoId.length > 150 ||
      !Object.hasOwn(transicoes, novoStatus)
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
      const documento = await transacao.get(pedidoRef);

      if (!documento.exists) {
        throw new HttpsError(
          "not-found",
          "Pedido não encontrado."
        );
      }

      const statusAtual = documento.data().status;

      if (!transicoes[statusAtual]?.includes(novoStatus)) {
        throw new HttpsError(
          "failed-precondition",
          "Essa mudança de status não é permitida."
        );
      }

      transacao.update(pedidoRef, {
        status: novoStatus,
        atualizadoEm: FieldValue.serverTimestamp(),
        atualizadoPor: request.auth.uid
      });
    });

    return {
      sucesso: true,
      pedidoId,
      novoStatus
    };
  }
);
```

