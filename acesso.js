```javascript
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

// Configuração do projeto Firebase Creamy.
const firebaseConfig = {
  apiKey: "AIzaSyCdebXzi_q8LuhCrKPI4P0YDWkRF1NQTuU",
  authDomain: "sorveteria-estoque-6c911.firebaseapp.com",
  projectId: "sorveteria-estoque-6c911",
  storageBucket: "sorveteria-estoque-6c911.firebasestorage.app",
  messagingSenderId: "338103318059",
  appId: "1:338103318059:web:4d99aaf6c148c1b2301c6e"
};

// Inicializa o Firebase sem criar aplicativos duplicados.
const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// Serviços compartilhados do Firebase.
export const auth = getAuth(app);
export const db = getFirestore(app);

// IMPORTANTE: deve corresponder à região das funções no servidor.
export const functions = getFunctions(
  app,
  "southamerica-east1"
);

export { httpsCallable };

// Página de destino de cada cargo autorizado.
const paginasPorCargo = Object.freeze({
  dono: "dono.html",
  estoque: "estoque.html",
  vendas: "vendas.html",
  cozinha: "cozinha.html",
  cliente: "cliente.html"
});

/**
 * Verifica a autenticação, o cargo e a sorveteria.
 *
 * ATENÇÃO:
 * Essa verificação no navegador melhora o direcionamento,
 * mas não substitui as regras do Firestore nem a validação
 * das permissões nas funções do servidor.
 */
export function verificarAcesso(cargosPermitidos) {
  return new Promise((resolve) => {
    let primeiraVerificacao = true;
    let cancelar = () => {};

    cancelar = onAuthStateChanged(auth, async (usuario) => {
      if (!primeiraVerificacao) return;

      primeiraVerificacao = false;
      cancelar();

      if (!usuario) {
        window.location.replace("./index.html");
        resolve(null);
        return;
      }

      try {
        if (!Array.isArray(cargosPermitidos)) {
          throw new Error("Lista de cargos permitidos inválida.");
        }

        // Atualiza os dados de autorização do token.
        const token = await usuario.getIdTokenResult(true);

        const cargo = token.claims.cargo;
        const sorveteriaId = token.claims.sorveteriaId;

        // Confere se o cargo e a sorveteria são válidos.
        if (
          typeof cargo !== "string" ||
          !Object.hasOwn(paginasPorCargo, cargo) ||
          typeof sorveteriaId !== "string" ||
          sorveteriaId.trim() === ""
        ) {
          throw new Error(
            "Conta sem cargo ou sorveteria autorizados."
          );
        }

        // Impede que o usuário permaneça em uma página
        // que não corresponde ao seu cargo.
        if (!cargosPermitidos.includes(cargo)) {
          window.location.replace(
            "./" + paginasPorCargo[cargo]
          );

          resolve(null);
          return;
        }

        // Retorna os dados necessários para a página.
        resolve({
          usuario,
          cargo,
          sorveteriaId
        });

      } catch (erro) {
        console.error(
          "Falha ao verificar acesso:",
          erro
        );

        alert(
          "Não foi possível validar seu acesso. " +
          "Peça ao proprietário para verificar sua conta."
        );

        try {
          await signOut(auth);
        } catch (erroSaida) {
          console.error(
            "Falha ao encerrar a sessão:",
            erroSaida
          );
        } finally {
          window.location.replace("./index.html");
          resolve(null);
        }
      }
    });
  });
}

// Encerra a sessão e volta à página de entrada.
export async function sairDaConta() {
  try {
    await signOut(auth);
  } finally {
    window.location.replace("./index.html");
  }
}
```
