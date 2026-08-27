/* =========================================================
   FIREBASE
========================================================= */

import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    runTransaction
} from
"https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


/* =========================================================
   CONFIGURAÇÃO DO SEU FIREBASE
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyCdebXzi_q8LuhCrKPI4P0YDWkRF1NQTuU",
    authDomain: "sorveteria-estoque-6c911.firebaseapp.com",
    projectId: "sorveteria-estoque-6c911",
    storageBucket: "sorveteria-estoque-6c911.firebasestorage.app",
    messagingSenderId: "338103318059",
    appId: "1:338103318059:web:4d99aaf6c148c1b2301c6e"
};


/* =========================================================
   INICIALIZAR FIREBASE
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================================
   DADOS DO SISTEMA
========================================================= */

let usuarioAtual = null;

let estoque = [];

let historico = [];

let retiradas = [];

let carrinho = [];


/* =========================================================
   PERSONALIZAÇÃO PADRÃO
========================================================= */

const personalizacaoPadrao = {

    fachada: "#e95fa5",

    rodape: "#e94a92",

    botoes: "#d64a91",

    ajuda: "#7b2cbf",

    fundo: "#f7d6e8",

    cartoes: "#ffffff",

    titulos: "#d64a91",

    texto: "#343434",

    textura: "bolinhas",

    tamanhoFonte: 100,

    tamanhoCaixa: 100,

    nomeSorveteria:
        "🍦 Creamy",

    subtitulo:
        "Sistema de Controle de Estoque, Vendas, Custos e Lucros",

    rodape1:
        "🍦 Sistema de Controle de Estoque da Creamy",

    rodape2:
        "Sistema de estoque, vendas, custos e lucros."
};


let cores = {
    ...personalizacaoPadrao
};


/* =========================================================
   FUNÇÕES DE CAMINHOS DO FIREBASE
========================================================= */

function colecaoProdutos() {

    return collection(
        db,
        "usuarios",
        usuarioAtual.uid,
        "produtos"
    );
}


function colecaoVendas() {

    return collection(
        db,
        "usuarios",
        usuarioAtual.uid,
        "vendas"
    );
}


function colecaoRetiradas() {

    return collection(
        db,
        "usuarios",
        usuarioAtual.uid,
        "retiradas"
    );
}


function documentoConfiguracao() {

    return doc(
        db,
        "usuarios",
        usuarioAtual.uid,
        "configuracoes",
        "personalizacao"
    );
}


/* =========================================================
   ESCAPAR TEXTO
========================================================= */

function escaparHTML(texto) {

    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   CONVERTER NÚMERO
   ACEITA VÍRGULA E PONTO
========================================================= */

function converterNumero(valor) {

    if (typeof valor === "number") {
        return valor;
    }

    if (
        valor === null ||
        valor === undefined ||
        String(valor).trim() === ""
    ) {
        return 0;
    }

    let texto =
        String(valor)
            .trim()
            .replace(/\s/g, "");


    if (
        texto.includes(",") &&
        texto.includes(".")
    ) {

        if (
            texto.lastIndexOf(",") >
            texto.lastIndexOf(".")
        ) {

            texto =
                texto
                    .replace(/\./g, "")
                    .replace(",", ".");

        } else {

            texto =
                texto
                    .replace(/,/g, "");
        }

    } else if (texto.includes(",")) {

        texto =
            texto.replace(",", ".");
    }


    const numero = Number(texto);

    return isNaN(numero)
        ? 0
        : numero;
}


/* =========================================================
   FORMATAR DINHEIRO
========================================================= */

function formatarDinheiro(valor) {

    return Number(valor || 0).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    );
}


/* =========================================================
   DATA ATUAL
========================================================= */

function obterDataAtual() {

    const agora = new Date();

    return {
        dataTexto:
            agora.toLocaleString("pt-BR"),

        dataISO:
            agora.toISOString(),

        dia:
            agora.toLocaleDateString("pt-BR")
    };
}


/* =========================================================
   LOGIN
========================================================= */

window.mostrarLogin = function () {

    document.getElementById(
        "formLogin"
    ).style.display = "block";

    document.getElementById(
        "formCadastro"
    ).style.display = "none";

    document.getElementById(
        "abaEntrar"
    ).classList.add("ativa");

    document.getElementById(
        "abaCadastrar"
    ).classList.remove("ativa");

    limparMensagemLogin();
};


window.mostrarCadastro = function () {

    document.getElementById(
        "formLogin"
    ).style.display = "none";

    document.getElementById(
        "formCadastro"
    ).style.display = "block";

    document.getElementById(
        "abaCadastrar"
    ).classList.add("ativa");

    document.getElementById(
        "abaEntrar"
    ).classList.remove("ativa");

    limparMensagemLogin();
};


function mostrarMensagemLogin(
    mensagem,
    sucesso = false
) {

    const elemento =
        document.getElementById(
            "mensagemLogin"
        );

    elemento.textContent = mensagem;

    elemento.style.color =
        sucesso
            ? "#2e8b57"
            : "#c0396b";
}


function limparMensagemLogin() {

    document.getElementById(
        "mensagemLogin"
    ).textContent = "";
}


/* =========================================================
   FORMULÁRIO DE LOGIN
========================================================= */

document
    .getElementById("formLogin")
    .addEventListener(
        "submit",
        async function (evento) {

            evento.preventDefault();

            const email =
                document
                    .getElementById("loginEmail")
                    .value
                    .trim();

            const senha =
                document
                    .getElementById("loginSenha")
                    .value;


            try {

                mostrarMensagemLogin(
                    "⏳ Entrando..."
                );


                await signInWithEmailAndPassword(
                    auth,
                    email,
                    senha
                );


                mostrarMensagemLogin(
                    "✅ Login realizado!",
                    true
                );

            } catch (erro) {

                console.error(erro);

                mostrarMensagemLogin(
                    "❌ E-mail ou senha incorretos."
                );
            }

        }
    );


/* =========================================================
   FORMULÁRIO DE CADASTRO
========================================================= */

document
    .getElementById("formCadastro")
    .addEventListener(
        "submit",
        async function (evento) {

            evento.preventDefault();

            const nome =
                document
                    .getElementById("cadastroNome")
                    .value
                    .trim();

            const email =
                document
                    .getElementById("cadastroEmail")
                    .value
                    .trim();

            const senha =
                document
                    .getElementById("cadastroSenha")
                    .value;


            if (nome === "") {

                mostrarMensagemLogin(
                    "❌ Digite o nome da sorveteria."
                );

                return;
            }


            try {

                mostrarMensagemLogin(
                    "⏳ Criando sua conta..."
                );


                const resultado =
                    await createUserWithEmailAndPassword(
                        auth,
                        email,
                        senha
                    );


                const uid =
                    resultado.user.uid;


                await setDoc(
                    doc(db, "usuarios", uid),
                    {
                        email,
                        dataCriacao:
                            obterDataAtual().dataTexto,
                        criadoEm:
                            serverTimestamp()
                    }
                );


                const novaPersonalizacao = {
                    ...personalizacaoPadrao,

                    nomeSorveteria:
                        `🍦 ${nome}`,

                    rodape1:
                        `🍦 Sistema de Controle da ${nome}`
                };


                await setDoc(
                    doc(
                        db,
                        "usuarios",
                        uid,
                        "configuracoes",
                        "personalizacao"
                    ),
                    novaPersonalizacao
                );


                mostrarMensagemLogin(
                    "🎉 Conta criada com sucesso!",
                    true
                );

            } catch (erro) {

                console.error(erro);


                if (
                    erro.code ===
                    "auth/email-already-in-use"
                ) {

                    mostrarMensagemLogin(
                        "❌ Este e-mail já possui uma conta."
                    );

                } else if (
                    erro.code ===
                    "auth/weak-password"
                ) {

                    mostrarMensagemLogin(
                        "❌ A senha precisa ter pelo menos 6 caracteres."
                    );

                } else {

                    mostrarMensagemLogin(
                        "❌ Não foi possível criar a conta."
                    );
                }

            }

        }
    );


/* =========================================================
   OBSERVAR LOGIN
========================================================= */

onAuthStateChanged(
    auth,
    async function (usuario) {

        if (usuario) {

            usuarioAtual = usuario;


            document.getElementById(
                "telaLogin"
            ).style.display = "none";


            document.getElementById(
                "sistema"
            ).style.display = "block";


            await carregarPersonalizacao();

            iniciarMonitoramentoDados();

        } else {

            usuarioAtual = null;

            estoque = [];

            historico = [];

            retiradas = [];

            carrinho = [];


            document.getElementById(
                "telaLogin"
            ).style.display = "flex";


            document.getElementById(
                "sistema"
            ).style.display = "none";

        }

    }
);


/* =========================================================
   SAIR
========================================================= */

window.sairDoSistema =
async function () {

    const confirmar = confirm(
        "Deseja realmente sair da sua conta?"
    );

    if (!confirmar) return;


    try {

        await signOut(auth);

    } catch (erro) {

        console.error(erro);

        alert(
            "Não foi possível sair da conta."
        );
    }

};


/* =========================================================
   CARREGAR PERSONALIZAÇÃO
========================================================= */

async function carregarPersonalizacao() {

    try {

        const referencia =
            documentoConfiguracao();

        const resultado =
            await getDoc(referencia);


        if (resultado.exists()) {

            cores = {
                ...personalizacaoPadrao,
                ...resultado.data()
            };

        } else {

            cores = {
                ...personalizacaoPadrao
            };


            await setDoc(
                referencia,
                cores
            );
        }


        aplicarCores();

    } catch (erro) {

        console.error(
            "Erro ao carregar personalização:",
            erro
        );
    }

}


/* =========================================================
   MONITORAR DADOS DO FIREBASE
========================================================= */
function iniciarMonitoramentoDados() {

    if (!usuarioAtual) {
        console.error("Nenhum usuário está logado.");
        return;
    }


    /* =========================================
       PRODUTOS
    ========================================= */

    onSnapshot(
        colecaoProdutos(),

        function (snapshot) {

            estoque = snapshot.docs.map(documento => ({

                id: documento.id,

                ...documento.data()

            }));


            // Ordena do mais recente para o mais antigo
            estoque.sort(function (a, b) {

                return String(b.dataCadastroISO || "")
                    .localeCompare(
                        String(a.dataCadastroISO || "")
                    );

            });


            atualizarEstoque();

            atualizarSelectProdutos();

        },

        function (erro) {

            console.error(
                "ERRO FIREBASE - PRODUTOS:",
                erro.code,
                erro.message
            );

        }
    );


    /* =========================================
       VENDAS
    ========================================= */

    onSnapshot(
        colecaoVendas(),

        function (snapshot) {

            historico = snapshot.docs.map(documento => ({

                id: documento.id,

                ...documento.data()

            }));


            // Ordena do mais recente para o mais antigo
            historico.sort(function (a, b) {

                return String(b.dataISO || "")
                    .localeCompare(
                        String(a.dataISO || "")
                    );

            });


            atualizarHistorico();

            atualizarResumo();

            atualizarGrafico();

        },

        function (erro) {

            console.error(
                "ERRO FIREBASE - VENDAS:",
                erro.code,
                erro.message
            );

        }
    );


    /* =========================================
       RETIRADAS
    ========================================= */

    onSnapshot(
        colecaoRetiradas(),

        function (snapshot) {

            retiradas = snapshot.docs.map(documento => ({

                id: documento.id,

                ...documento.data()

            }));


            // Ordena do mais recente para o mais antigo
            retiradas.sort(function (a, b) {

                return String(b.dataISO || "")
                    .localeCompare(
                        String(a.dataISO || "")
                    );

            });


            atualizarRetiradas();

        },

        function (erro) {

            console.error(
                "ERRO FIREBASE - RETIRADAS:",
                erro.code,
                erro.message
            );

        }
    );

}


/* =========================================================
   LIMPAR FORMULÁRIO
========================================================= */

function limparFormularioProduto() {

    document
        .getElementById(
            "nomeProduto"
        ).value = "";

    document
        .getElementById(
            "quantidadeProduto"
        ).value = "";

    document
        .getElementById(
            "custoProduto"
        ).value = "";

    document
        .getElementById(
            "precoProduto"
        ).value = "";
}

/* =========================================================
   ADICIONAR PRODUTO AO ESTOQUE
========================================================= */

window.adicionarProduto =
async function () {

    if (!usuarioAtual) {

        alert(
            "❌ Você precisa estar logado para adicionar produtos."
        );

        return;
    }


    const nome =
        document
            .getElementById(
                "nomeProduto"
            )
            .value
            .trim();


    const categoria =
        document
            .getElementById(
                "categoriaProduto"
            )
            .value;


    const quantidade =
        converterNumero(
            document
                .getElementById(
                    "quantidadeProduto"
                )
                .value
        );


    const unidade =
        document
            .getElementById(
                "unidadeProduto"
            )
            .value;


    const custo =
        converterNumero(
            document
                .getElementById(
                    "custoProduto"
                )
                .value
        );


    const preco =
        converterNumero(
            document
                .getElementById(
                    "precoProduto"
                )
                .value
        );


    /* =========================================
       VALIDAÇÕES
    ========================================= */

    if (nome === "") {

        alert(
            "⚠️ Digite o nome do produto."
        );

        return;
    }


    if (quantidade <= 0) {

        alert(
            "⚠️ Digite uma quantidade válida."
        );

        return;
    }


    if (custo < 0) {

        alert(
            "⚠️ Digite um custo válido."
        );

        return;
    }


    if (preco < 0) {

        alert(
            "⚠️ Digite um preço de venda válido."
        );

        return;
    }


    /* =========================================
       SALVAR NO FIREBASE
    ========================================= */

    try {

        const data =
            obterDataAtual();


        await addDoc(
            colecaoProdutos(),
            {

                nome,

                categoria,

                quantidade,

                unidade,

                custo,

                preco,


                dataCadastro:
                    data.dataTexto,


                dataCadastroISO:
                    data.dataISO,


                criadoEm:
                    serverTimestamp()

            }
        );


        limparFormularioProduto();


        alert(
            "🎉 Produto adicionado ao estoque com sucesso!"
        );

    } catch (erro) {

        console.error(
            "Erro ao adicionar produto:",
            erro
        );


        alert(
            "❌ Não foi possível adicionar o produto ao estoque."
        );
    }

};

/* =========================================================
   ATUALIZAR ESTOQUE
========================================================= */

function atualizarEstoque() {

    const tabela =
        document.getElementById(
            "tabelaEstoque"
        );


    tabela.innerHTML = "";


    if (estoque.length === 0) {

        tabela.innerHTML = `
            <tr>
                <td colspan="7">
                    📦 Nenhum produto cadastrado.
                </td>
            </tr>
        `;

        return;
    }


    estoque.forEach(produto => {

        const linha =
            document.createElement("tr");


        linha.innerHTML = `

            <td>
                ${escaparHTML(produto.nome)}
            </td>

            <td>
                ${escaparHTML(produto.categoria)}
            </td>

            <td>
                ${produto.quantidade}
                ${escaparHTML(produto.unidade)}
            </td>

            <td>
                ${formatarDinheiro(produto.custo)}
            </td>

            <td>
                ${formatarDinheiro(produto.preco)}
            </td>

            <td>
                ${produto.dataCadastro || "-"}
            </td>

            <td>

                <button
                    class="btn-pequeno"
                    onclick="adicionarEstoque('${produto.id}')"
                    title="Adicionar quantidade"
                >
                    ➕
                </button>

                <button
                    class="btn-pequeno"
                    onclick="removerProduto('${produto.id}')"
                    title="Remover produto"
                >
                    🗑️
                </button>

            </td>
        `;


        tabela.appendChild(linha);

    });

}


/* =========================================================
   ADICIONAR QUANTIDADE AO ESTOQUE
========================================================= */

window.adicionarEstoque =
async function (id) {

    const produto =
        estoque.find(
            produto =>
                produto.id === id
        );


    if (!produto) return;


    const resposta =
        prompt(
            `Quantas ${produto.unidade} deseja adicionar ao estoque?`
        );


    if (resposta === null) return;


    const quantidade =
        converterNumero(resposta);


    if (quantidade <= 0) {

        alert(
            "Digite uma quantidade válida."
        );

        return;
    }


    try {

        const data =
            obterDataAtual();


        await updateDoc(
            doc(
                db,
                "usuarios",
                usuarioAtual.uid,
                "produtos",
                id
            ),
            {

                quantidade:
                    Number(
                        produto.quantidade
                    ) + quantidade,

                dataAtualizacao:
                    data.dataTexto,

                dataAtualizacaoISO:
                    data.dataISO

            }
        );


        alert(
            "📦 Estoque atualizado!"
        );

    } catch (erro) {

        console.error(erro);

        alert(
            "❌ Não foi possível atualizar o estoque."
        );
    }

};


/* =========================================================
   REMOVER PRODUTO
========================================================= */

window.removerProduto =
async function (id) {

    const confirmar =
        confirm(
            "Deseja realmente remover este produto completamente do estoque?"
        );


    if (!confirmar) return;


    try {

        await deleteDoc(
            doc(
                db,
                "usuarios",
                usuarioAtual.uid,
                "produtos",
                id
            )
        );

    } catch (erro) {

        console.error(erro);

        alert(
            "❌ Não foi possível remover o produto."
        );
    }

};


/* =========================================================
   ATUALIZAR SELECTS
========================================================= */

function atualizarSelectProdutos() {

    const selectVenda =
        document.getElementById(
            "produtoVenda"
        );

    const selectRetirada =
        document.getElementById(
            "produtoRetirada"
        );


    const valorVendaAtual =
        selectVenda.value;

    const valorRetiradaAtual =
        selectRetirada.value;


    selectVenda.innerHTML =
        '<option value="">Selecione um produto</option>';

    selectRetirada.innerHTML =
        '<option value="">Selecione um produto</option>';


    estoque.forEach(produto => {

        if (produto.quantidade > 0) {

            const texto =
                `${produto.nome} (${produto.quantidade} ${produto.unidade})`;


            selectVenda.innerHTML += `

                <option value="${produto.id}">
                    ${escaparHTML(texto)}
                </option>
            `;


            selectRetirada.innerHTML += `

                <option value="${produto.id}">
                    ${escaparHTML(texto)}
                </option>
            `;
        }

    });


    selectVenda.value =
        valorVendaAtual;

    selectRetirada.value =
        valorRetiradaAtual;

}


/* =========================================================
   ADICIONAR AO CARRINHO
========================================================= */

window.adicionarAoCarrinho =
function () {

    const id =
        document
            .getElementById(
                "produtoVenda"
            ).value;

    const quantidade =
        converterNumero(
            document
                .getElementById(
                    "quantidadeVenda"
                ).value
        );


    if (!id || quantidade <= 0) {

        alert(
            "⚠️ Escolha um produto e informe uma quantidade válida."
        );

        return;
    }


    const produto =
        estoque.find(
            produto =>
                produto.id === id
        );


    if (!produto) {

        alert(
            "Produto não encontrado."
        );

        return;
    }


    const jaNoCarrinho =
        carrinho
            .filter(
                item =>
                    item.id === id
            )
            .reduce(
                (total, item) =>
                    total +
                    item.quantidade,
                0
            );


    if (
        quantidade +
        jaNoCarrinho >
        produto.quantidade
    ) {

        alert(
            `⚠️ Estoque insuficiente. Disponível: ${produto.quantidade} ${produto.unidade}`
        );

        return;
    }


    const itemExistente =
        carrinho.find(
            item =>
                item.id === id
        );


    if (itemExistente) {

        itemExistente.quantidade +=
            quantidade;

    } else {

        carrinho.push({

            id:
                produto.id,

            nome:
                produto.nome,

            unidade:
                produto.unidade,

            quantidade,

            preco:
                produto.preco,

            custo:
                produto.custo

        });
    }


    atualizarCarrinho();


    document
        .getElementById(
            "quantidadeVenda"
        ).value = "";

};


/* =========================================================
   ATUALIZAR CARRINHO
========================================================= */

function atualizarCarrinho() {

    const lista =
        document.getElementById(
            "listaCarrinho"
        );

    const totalElemento =
        document.getElementById(
            "totalCarrinho"
        );


    if (carrinho.length === 0) {

        lista.innerHTML =
            "<p>Nenhum produto adicionado.</p>";

        totalElemento.textContent =
            "R$ 0,00";

        return;
    }


    let total = 0;

    lista.innerHTML = "";


    carrinho.forEach(
        (item, indice) => {

            const subtotal =
                item.quantidade *
                item.preco;


            total += subtotal;


            lista.innerHTML += `

                <div class="item-carrinho">

                    <span>

                        <strong>
                            ${escaparHTML(item.nome)}
                        </strong>

                        <br>

                        ${item.quantidade}
                        ${escaparHTML(item.unidade)}

                        —
                        ${formatarDinheiro(subtotal)}

                    </span>


                    <button
                        class="btn-pequeno"
                        onclick="removerDoCarrinho(${indice})"
                    >
                        ❌
                    </button>

                </div>
            `;

        }
    );


    totalElemento.textContent =
        formatarDinheiro(total);

}


/* =========================================================
   REMOVER DO CARRINHO
========================================================= */

window.removerDoCarrinho =
function (indice) {

    carrinho.splice(
        indice,
        1
    );

    atualizarCarrinho();

};


/* =========================================================
   FINALIZAR VENDA
========================================================= */

window.finalizarVenda =
async function () {

    if (carrinho.length === 0) {

        alert(
            "🛒 Adicione pelo menos um produto à venda."
        );

        return;
    }


    try {

        await runTransaction(
            db,

            async function (transaction) {

                for (
                    const item of carrinho
                ) {

                    const referencia =
                        doc(
                            db,
                            "usuarios",
                            usuarioAtual.uid,
                            "produtos",
                            item.id
                        );


                    const documento =
                        await transaction.get(
                            referencia
                        );


                    if (
                        !documento.exists()
                    ) {

                        throw new Error(
                            `Produto ${item.nome} não encontrado.`
                        );
                    }


                    const dados =
                        documento.data();


                    if (
                        dados.quantidade <
                        item.quantidade
                    ) {

                        throw new Error(
                            `Estoque insuficiente para ${item.nome}.`
                        );
                    }


                    transaction.update(
                        referencia,
                        {

                            quantidade:
                                dados.quantidade -
                                item.quantidade

                        }
                    );

                }


                let valorTotal = 0;

                let custoTotal = 0;


                carrinho.forEach(item => {

                    valorTotal +=
                        item.quantidade *
                        item.preco;

                    custoTotal +=
                        item.quantidade *
                        item.custo;

                });


                const lucro =
                    valorTotal -
                    custoTotal;


                const data =
                    obterDataAtual();


                const novaVenda =
                    doc(
                        colecaoVendas()
                    );


                transaction.set(
                    novaVenda,
                    {

                        data:
                            data.dataTexto,

                        dataISO:
                            data.dataISO,

                        dia:
                            data.dia,

                        itens:
                            carrinho.map(
                                item => ({
                                    ...item
                                })
                            ),

                        receita:
                            valorTotal,

                        custo:
                            custoTotal,

                        lucro,

                        criadoEm:
                            serverTimestamp()

                    }
                );

            }
        );


        carrinho = [];

        atualizarCarrinho();


        alert(
            "🎉 Venda finalizada com sucesso!"
        );

    } catch (erro) {

        console.error(erro);

        alert(
            `❌ ${erro.message}`
        );
    }

};


/* =========================================================
   RETIRAR PRODUTO
========================================================= */

window.retirarProduto =
async function () {

    const id =
        document
            .getElementById(
                "produtoRetirada"
            ).value;

    const quantidade =
        converterNumero(
            document
                .getElementById(
                    "quantidadeRetirada"
                ).value
        );


    if (!id || quantidade <= 0) {

        alert(
            "⚠️ Escolha um produto e informe uma quantidade válida."
        );

        return;
    }


    const produto =
        estoque.find(
            produto =>
                produto.id === id
        );


    if (!produto) return;


    if (
        quantidade >
        produto.quantidade
    ) {

        alert(
            "⚠️ Quantidade maior que o estoque disponível."
        );

        return;
    }


    try {

        const data =
            obterDataAtual();


        await updateDoc(
            doc(
                db,
                "usuarios",
                usuarioAtual.uid,
                "produtos",
                id
            ),
            {

                quantidade:
                    produto.quantidade -
                    quantidade,

                dataAtualizacao:
                    data.dataTexto,

                dataAtualizacaoISO:
                    data.dataISO

            }
        );


        await addDoc(
            colecaoRetiradas(),
            {

                data:
                    data.dataTexto,

                dataISO:
                    data.dataISO,

                dia:
                    data.dia,

                nome:
                    produto.nome,

                quantidade,

                unidade:
                    produto.unidade,

                criadoEm:
                    serverTimestamp()

            }
        );


        document
            .getElementById(
                "quantidadeRetirada"
            ).value = "";


        alert(
            "📦 Retirada registrada com sucesso!"
        );

    } catch (erro) {

        console.error(erro);

        alert(
            "❌ Ocorreu um erro ao registrar a retirada."
        );
    }

};


/* =========================================================
   HISTÓRICO DE VENDAS
========================================================= */

function atualizarHistorico() {

    const lista =
        document.getElementById(
            "listaHistorico"
        );


    if (historico.length === 0) {

        lista.innerHTML =
            "<p>🧾 Nenhuma venda registrada.</p>";

        return;
    }


    lista.innerHTML = "";


    historico.forEach(venda => {

        const produtos =
            venda.itens
                .map(
                    item =>
                        `${escaparHTML(item.nome)} (${item.quantidade} ${escaparHTML(item.unidade)})`
                )
                .join(", ");


        lista.innerHTML += `

            <div class="item-historico">

                <strong>
                    📅 ${venda.data}
                </strong>

                <p>
                    🛒 ${produtos}
                </p>

                <p>
                    💰 Receita:
                    ${formatarDinheiro(venda.receita)}
                </p>

                <p>
                    📉 Custo:
                    ${formatarDinheiro(venda.custo)}
                </p>

                <p>
                    📈 Lucro:
                    ${formatarDinheiro(venda.lucro)}
                </p>

            </div>
        `;

    });

}


/* =========================================================
   HISTÓRICO DE RETIRADAS
========================================================= */

function atualizarRetiradas() {

    const lista =
        document.getElementById(
            "listaRetiradas"
        );


    if (retiradas.length === 0) {

        lista.innerHTML =
            "<p>📦 Nenhuma retirada registrada.</p>";

        return;
    }


    lista.innerHTML = "";


    retiradas.forEach(retirada => {

        lista.innerHTML += `

            <div class="item-historico">

                <strong>
                    📅 ${retirada.data}
                </strong>

                <p>
                    📦 Produto:
                    ${escaparHTML(retirada.nome)}
                </p>

                <p>
                    ➖ Quantidade:
                    ${retirada.quantidade}
                    ${escaparHTML(retirada.unidade)}
                </p>

            </div>
        `;

    });

}


/* =========================================================
   RESUMO FINANCEIRO
========================================================= */

function atualizarResumo() {

    let receita = 0;

    let custos = 0;


    historico.forEach(venda => {

        receita +=
            Number(venda.receita || 0);

        custos +=
            Number(venda.custo || 0);

    });


    const lucro =
        receita - custos;


    document
        .getElementById(
            "receita"
        ).textContent =
        formatarDinheiro(receita);


    document
        .getElementById(
            "custos"
        ).textContent =
        formatarDinheiro(custos);


    document
        .getElementById(
            "lucro"
        ).textContent =
        formatarDinheiro(lucro);

}


/* =========================================================
   GRÁFICO
========================================================= */

function atualizarGrafico() {

    const grafico =
        document.getElementById(
            "graficoVendas"
        );

    const dados = {};


    historico.forEach(venda => {

        venda.itens.forEach(item => {

            if (!dados[item.nome]) {

                dados[item.nome] = 0;

            }


            dados[item.nome] +=
                Number(item.quantidade);

        });

    });


    const nomes =
        Object.keys(dados);


    if (nomes.length === 0) {

        grafico.innerHTML = `

            <div class="grafico-vazio">
                📊 Nenhuma venda registrada ainda.
            </div>
        `;

        return;
    }


    const maiorValor =
        Math.max(
            ...Object.values(dados)
        );


    grafico.innerHTML = "";


    nomes.forEach(nome => {

        const quantidade =
            dados[nome];


        const altura =
            Math.max(
                20,
                (quantidade / maiorValor) *
                200
            );


        grafico.innerHTML += `

            <div class="barra-grafico">

                <div class="valor-barra">
                    ${quantidade}
                </div>

                <div
                    class="barra"
                    style="height: ${altura}px"
                ></div>

                <div class="nome-barra">
                    ${escaparHTML(nome)}
                </div>

            </div>
        `;

    });

}


/* =========================================================
   EXPORTAR EXCEL
========================================================= */

window.exportarExcel =
function () {

    if (historico.length === 0) {

        alert(
            "⚠️ Não há vendas para exportar."
        );

        return;
    }


    let csv =
        "Data;Produtos;Receita;Custos;Lucro\n";


    historico.forEach(venda => {

        const produtos =
            venda.itens
                .map(
                    item =>
                        `${item.nome} - ${item.quantidade} ${item.unidade}`
                )
                .join(" | ");


        csv +=

            `"${venda.data}";` +

            `"${produtos}";` +

            `"${Number(venda.receita).toFixed(2).replace(".", ",")}";` +

            `"${Number(venda.custo).toFixed(2).replace(".", ",")}";` +

            `"${Number(venda.lucro).toFixed(2).replace(".", ",")}"\n`;

    });


    const blob =
        new Blob(
            ["\uFEFF" + csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        "historico_vendas_sorveteria.csv";


    link.click();


    URL.revokeObjectURL(url);

};


/* =========================================================
   LIMPAR HISTÓRICO
========================================================= */

window.limparHistorico =
async function () {

    const confirmar =
        confirm(
            "⚠️ Deseja realmente apagar todo o histórico de vendas?"
        );


    if (!confirmar) return;


    try {

        const documentos =
            await getDocs(
                colecaoVendas()
            );


        const promessas =
            documentos.docs.map(
                documento =>
                    deleteDoc(
                        documento.ref
                    )
            );


        await Promise.all(promessas);


        alert(
            "🗑️ Histórico apagado com sucesso."
        );

    } catch (erro) {

        console.error(erro);

        alert(
            "❌ Não foi possível limpar o histórico."
        );
    }

};


/* =========================================================
   ENCERRAMENTO DO DIA
========================================================= */

window.encerrarDia =
function () {

    const hoje =
        new Date()
            .toISOString()
            .slice(0, 10);


    const vendasHoje =
        historico.filter(
            venda =>
                venda.dataISO &&
                venda.dataISO.startsWith(hoje)
        );


    let receitaDia = 0;

    let custoDia = 0;


    vendasHoje.forEach(venda => {

        receitaDia +=
            Number(venda.receita || 0);

        custoDia +=
            Number(venda.custo || 0);

    });


    const lucroDia =
        receitaDia -
        custoDia;


    alert(

        "🌙 ENCERRAMENTO DO DIA\n\n" +

        `📅 Data: ${new Date().toLocaleDateString("pt-BR")}\n\n` +

        `💰 Receita de hoje: ${formatarDinheiro(receitaDia)}\n` +

        `📉 Custos de hoje: ${formatarDinheiro(custoDia)}\n` +

        `📈 Lucro de hoje: ${formatarDinheiro(lucroDia)}\n\n` +

        `🛒 Vendas realizadas hoje: ${vendasHoje.length}`

    );

};


/* =========================================================
   PERSONALIZAÇÃO
========================================================= */

window.abrirPersonalizacao =
function () {

    document
        .getElementById(
            "modalPersonalizacao"
        ).style.display = "block";


    document
        .getElementById(
            "corFachada"
        ).value = cores.fachada;

    document
        .getElementById(
            "corRodape"
        ).value = cores.rodape;

    document
        .getElementById(
            "corBotoes"
        ).value = cores.botoes;

    document
        .getElementById(
            "corAjuda"
        ).value = cores.ajuda;

    document
        .getElementById(
            "corFundo"
        ).value = cores.fundo;

    document
        .getElementById(
            "corCartoes"
        ).value = cores.cartoes;

    document
        .getElementById(
            "corTitulos"
        ).value = cores.titulos;

    document
        .getElementById(
            "corTexto"
        ).value = cores.texto;

    document
        .getElementById(
            "texturaSite"
        ).value = cores.textura;

    document
        .getElementById(
            "tamanhoFonte"
        ).value = cores.tamanhoFonte;

    document
        .getElementById(
            "tamanhoCaixa"
        ).value = cores.tamanhoCaixa;


    document
        .getElementById(
            "valorTamanhoFonte"
        ).textContent =
        `${cores.tamanhoFonte}%`;

    document
        .getElementById(
            "valorTamanhoCaixa"
        ).textContent =
        `${cores.tamanhoCaixa}%`;


    document
        .getElementById(
            "novoNomeSorveteria"
        ).value =
        cores.nomeSorveteria;

    document
        .getElementById(
            "novoSubtituloSorveteria"
        ).value =
        cores.subtitulo;

    document
        .getElementById(
            "novoTextoRodape1"
        ).value =
        cores.rodape1;

    document
        .getElementById(
            "novoTextoRodape2"
        ).value =
        cores.rodape2;

};


window.fecharPersonalizacao =
function () {

    document
        .getElementById(
            "modalPersonalizacao"
        ).style.display = "none";

};


/* =========================================================
   MOSTRAR TAMANHOS EM TEMPO REAL
========================================================= */

document
    .getElementById("tamanhoFonte")
    .addEventListener(
        "input",
        function () {

            document
                .getElementById(
                    "valorTamanhoFonte"
                ).textContent =
                `${this.value}%`;

        }
    );


document
    .getElementById("tamanhoCaixa")
    .addEventListener(
        "input",
        function () {

            document
                .getElementById(
                    "valorTamanhoCaixa"
                ).textContent =
                `${this.value}%`;

        }
    );


/* =========================================================
   SALVAR PERSONALIZAÇÃO
========================================================= */

window.aplicarPersonalizacao =
async function () {

    cores.fachada =
        document
            .getElementById(
                "corFachada"
            ).value;

    cores.rodape =
        document
            .getElementById(
                "corRodape"
            ).value;

    cores.botoes =
        document
            .getElementById(
                "corBotoes"
            ).value;

    cores.ajuda =
        document
            .getElementById(
                "corAjuda"
            ).value;

    cores.fundo =
        document
            .getElementById(
                "corFundo"
            ).value;

    cores.cartoes =
        document
            .getElementById(
                "corCartoes"
            ).value;

    cores.titulos =
        document
            .getElementById(
                "corTitulos"
            ).value;

    cores.texto =
        document
            .getElementById(
                "corTexto"
            ).value;

    cores.textura =
        document
            .getElementById(
                "texturaSite"
            ).value;

    cores.tamanhoFonte =
        Number(
            document
                .getElementById(
                    "tamanhoFonte"
                ).value
        );

    cores.tamanhoCaixa =
        Number(
            document
                .getElementById(
                    "tamanhoCaixa"
                ).value
        );

    cores.nomeSorveteria =
        document
            .getElementById(
                "novoNomeSorveteria"
            ).value
            .trim() ||
        personalizacaoPadrao.nomeSorveteria;

    cores.subtitulo =
        document
            .getElementById(
                "novoSubtituloSorveteria"
            ).value
            .trim() ||
        personalizacaoPadrao.subtitulo;

    cores.rodape1 =
        document
            .getElementById(
                "novoTextoRodape1"
            ).value
            .trim() ||
        personalizacaoPadrao.rodape1;

    cores.rodape2 =
        document
            .getElementById(
                "novoTextoRodape2"
            ).value
            .trim() ||
        personalizacaoPadrao.rodape2;


    try {

        await setDoc(
            documentoConfiguracao(),
            cores
        );


        aplicarCores();

        fecharPersonalizacao();


        alert(
            "🎨 Personalização salva com sucesso!"
        );

    } catch (erro) {

        console.error(erro);

        alert(
            "❌ Não foi possível salvar a personalização."
        );
    }

};


/* =========================================================
   APLICAR CORES E PERSONALIZAÇÃO
========================================================= */

function aplicarCores() {

    const root =
        document.documentElement;


    root.style.setProperty(
        "--cor-fachada",
        cores.fachada
    );

    root.style.setProperty(
        "--cor-rodape",
        cores.rodape
    );

    root.style.setProperty(
        "--cor-botoes",
        cores.botoes
    );

    root.style.setProperty(
        "--cor-ajuda",
        cores.ajuda
    );

    root.style.setProperty(
        "--cor-fundo",
        cores.fundo
    );

    root.style.setProperty(
        "--cor-cartoes",
        cores.cartoes
    );

    root.style.setProperty(
        "--cor-titulos",
        cores.titulos
    );

    root.style.setProperty(
        "--cor-texto",
        cores.texto
    );

    root.style.setProperty(
        "--escala-fonte",
        cores.tamanhoFonte / 100
    );

    root.style.setProperty(
        "--escala-caixa",
        cores.tamanhoCaixa / 100
    );


    document.body.classList.remove(
        "textura-bolinhas",
        "textura-listras",
        "textura-liso"
    );


    document.body.classList.add(
        "textura-" +
        cores.textura
    );


    document
        .getElementById(
            "nomeSorveteria"
        ).textContent =
        cores.nomeSorveteria;

    document
        .getElementById(
            "subtituloSorveteria"
        ).textContent =
        cores.subtitulo;

    document
        .getElementById(
            "textoRodape1"
        ).textContent =
        cores.rodape1;

    document
        .getElementById(
            "textoRodape2"
        ).textContent =
        cores.rodape2;

    document.title =
        cores.nomeSorveteria
            .replace("🍦", "")
            .trim();

}


/* =========================================================
   RESTAURAR PERSONALIZAÇÃO
========================================================= */

window.restaurarPersonalizacao =
async function () {

    const confirmar =
        confirm(
            "Deseja restaurar todas as configurações originais?"
        );


    if (!confirmar) return;


    cores = {
        ...personalizacaoPadrao
    };


    try {

        await setDoc(
            documentoConfiguracao(),
            cores
        );


        aplicarCores();

        abrirPersonalizacao();


        alert(
            "🎨 O visual original foi restaurado!"
        );

    } catch (erro) {

        console.error(erro);

        alert(
            "❌ Não foi possível restaurar a personalização."
        );
    }

};


/* =========================================================
   AJUDA
========================================================= */

window.abrirAjuda =
function () {

    document
        .getElementById(
            "modalAjuda"
        ).style.display = "block";

};


window.fecharAjuda =
function () {

    document
        .getElementById(
            "modalAjuda"
        ).style.display = "none";

};


/* =========================================================
   ROLAR PARA SEÇÃO
========================================================= */

window.rolarPara =
function (id) {

    const elemento =
        document.getElementById(id);


    if (!elemento) return;


    elemento.scrollIntoView(
        {
            behavior: "smooth"
        }
    );

};


/* =========================================================
   FECHAR MODAL CLICANDO FORA
========================================================= */

window.addEventListener(
    "click",
    function (evento) {

        const modalPersonalizacao =
            document.getElementById(
                "modalPersonalizacao"
            );

        const modalAjuda =
            document.getElementById(
                "modalAjuda"
            );


        if (
            evento.target ===
            modalPersonalizacao
        ) {

            fecharPersonalizacao();
        }


        if (
            evento.target ===
            modalAjuda
        ) {

            fecharAjuda();
        }

    }
);
