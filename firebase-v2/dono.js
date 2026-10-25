
import { auth, db, sairDaConta } from "./acesso.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const receitaElemento = document.getElementById("receitaTotal");
const custosElemento = document.getElementById("custosTotal");
const lucroElemento = document.getElementById("lucroTotal");

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

let cancelarVendas = null;

onAuthStateChanged(auth, async (usuario) => {
  if (cancelarVendas) {
    cancelarVendas();
    cancelarVendas = null;
  }

  if (!usuario) {
    location.href = "./index.html";
    return;
  }

  try {
    const token = await usuario.getIdTokenResult(true);
    const cargo = token.claims.cargo;
    const sorveteriaId = token.claims.sorveteriaId;

    if (cargo !== "dono" || !sorveteriaId) {
      alert("Esta área é exclusiva do proprietário.");
      await sairDaConta();
      location.href = "./index.html";
      return;
    }

    const vendasRef = collection(
      db,
      "Sorveterias",
      sorveteriaId,
      "vendas"
    );

    cancelarVendas = onSnapshot(
      vendasRef,
      (snapshot) => {
        let receita = 0;
        let custos = 0;
        let lucro = 0;

        snapshot.forEach((documento) => {
          const venda = documento.data();

          receita += Number(venda.receita || 0);
          custos += Number(venda.custo || 0);
          lucro += Number(venda.lucro || 0);
        });

        receitaElemento.textContent = moeda.format(receita);
        custosElemento.textContent = moeda.format(custos);
        lucroElemento.textContent = moeda.format(lucro);
      },
      (erro) => {
        console.error("Erro ao carregar vendas:", erro);
        alert("Não foi possível carregar os dados financeiros.");
      }
    );
  } catch (erro) {
    console.error("Erro ao verificar acesso:", erro);
    alert("Não foi possível validar seu acesso.");
    location.href = "./index.html";
  }
});
