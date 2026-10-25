
import { initializeApp, getApps, getApp } from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// Use a mesma configuração Firebase do script.js original.
const firebaseConfig = {
  apiKey: "AIzaSyCdebXzi_q8LuhCrKPI4P0YDWkRF1NQTuU",
  authDomain: "sorveteria-estoque-6c911.firebaseapp.com",
  projectId: "sorveteria-estoque-6c911",
  storageBucket: "sorveteria-estoque-6c911.firebasestorage.app",
  messagingSenderId: "338103318059",
  appId: "1:338103318059:web:4d99aaf6c148c1b2301c6e"
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

const paginasPorCargo = {
  dono: "dono.html",
  estoque: "estoque.html",
  vendas: "vendas.html",
  cozinha: "cozinha.html",
  cliente: "cliente.html"
};

export function verificarAcesso(cargosPermitidos) {
  return new Promise((resolve) => {
    const cancelar = onAuthStateChanged(auth, async (usuario) => {
      cancelar();

      if (!usuario) {
        window.location.replace("./index.html");
        resolve(null);
        return;
      }

      try {
        // A função administrativa deve atribuir estas claims
        // depois de validar a conta e o cargo no servidor.
        const token = await usuario.getIdTokenResult(true);
        const cargo = token.claims.cargo;
        const sorveteriaId = token.claims.sorveteriaId;

        if (
          typeof cargo !== "string" ||
          !paginasPorCargo[cargo] ||
          typeof sorveteriaId !== "string"
        ) {
          throw new Error("Conta sem cargo autorizado.");
        }

        if (!cargosPermitidos.includes(cargo)) {
          window.location.replace(
            "./" + paginasPorCargo[cargo]
          );
          resolve(null);
          return;
        }

        resolve({
          usuario,
          cargo,
          sorveteriaId
        });
      } catch (erro) {
        console.error("Falha ao verificar acesso:", erro);
        alert(
          "Não foi possível validar seu acesso. " +
          "Peça ao proprietário para verificar sua conta."
        );
        await signOut(auth);
        window.location.replace("./index.html");
        resolve(null);
      }
    });
  });
}

export async function sairDaConta() {
  await signOut(auth);
  window.location.replace("./index.html");
}
