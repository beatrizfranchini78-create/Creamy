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
