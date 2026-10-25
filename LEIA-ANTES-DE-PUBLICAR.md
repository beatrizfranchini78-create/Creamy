# Creamy V2 — primeiro bloco de código

Este diretório acrescenta a base de segurança e a função de servidor para criar contas de funcionários. **Ele ainda não substitui o `script.js` original nem implementa todas as telas**. O sistema atual usa `usuarios/{uid}/produtos`, `vendas` e `retiradas`; as regras V2 usam `Sorveterias/{sorveteriaId}/...`. Publicar as regras V2 antes de migrar o JavaScript pode bloquear o sistema atual.

## Arquivos
- `firestore.rules`: regras de acesso por cargo para o modelo compartilhado.
- `functions/index.js`: função `criarFuncionario`, só utilizável pelo dono ativo.
- `functions/package.json`: dependências da função.

## Antes de publicar
1. Mantenha o app atual e seus dados como estão.
2. No Firebase Console, confirme que a sorveteria é `Sorveterias/creamy001` (S maiúsculo).
3. Em `Sorveterias/creamy001/funcionarios/{UID_DO_DONO}`, crie manualmente um documento para o UID da conta proprietária já existente, com os campos:
   - `uid`: UID da conta existente
   - `cargo`: `dono`
   - `ativo`: `true`
   - `nome`: nome do proprietário
   - `email`: e-mail da conta
4. **Não publique ainda `firestore.rules`**: a migração dos caminhos do `script.js` precisa acontecer primeiro e deve ser testada com contas de cada cargo.
5. A função exige Firebase Functions e o plano/recursos necessários no projeto. Não coloque chave de Admin SDK no navegador.

## O que ainda falta para completar a V2
- Migrador idempotente de produtos/vendas/retiradas para os caminhos compartilhados.
- Atualizar o app atual para consultar perfil/cargo antes de abrir cada área.
- Criar URLs e telas separadas de dono, estoque, vendas, cozinha e cliente.
- Tela de fila da cozinha com atualizações em tempo real.
- Portal do cliente com carrinho, entrega/retirada/consumo no local, rastreio, avaliações e sugestões.
- Manuais e botão de suporte em todas as telas.
- Testes das regras no Emulator antes de publicação.
