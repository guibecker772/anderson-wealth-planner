# Google Drive Import Setup

## Objetivo

Automatizar a descoberta e a ingestao de arquivos Excel em uma pasta compartilhada do Google Drive, reaproveitando o pipeline ja existente de staging e publicacao.

## Variaveis de ambiente

Configure estas variaveis no ambiente hospedado:

```env
GOOGLE_DRIVE_CLIENT_EMAIL=service-account@project-id.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_IMPERSONATE_USER=
CRON_SECRET=um-segredo-forte
DRIVE_SYNC_STABILITY_SECONDS=300
DRIVE_SYNC_LEASE_SECONDS=900
DRIVE_SYNC_MAX_ATTEMPTS=3
DRIVE_SYNC_RETRY_BASE_MS=1500
DRIVE_SYNC_ALERT_FAILURE_THRESHOLD=3
DRIVE_SYNC_ALERT_COOLDOWN_SECONDS=21600
```

Observacoes:

- `GOOGLE_DRIVE_CLIENT_EMAIL` e `GOOGLE_DRIVE_PRIVATE_KEY` pertencem a uma Service Account.
- `GOOGLE_DRIVE_IMPERSONATE_USER` e opcional. Use apenas se houver delegacao de dominio e isso fizer parte da sua operacao.
- O compartilhamento da pasta ou do Shared Drive precisa incluir a Service Account com permissao de leitura.
- `DRIVE_SYNC_STABILITY_SECONDS` define quanto tempo o arquivo precisa ficar estavel apos `modifiedTime` antes de ser processado.
- `DRIVE_SYNC_LEASE_SECONDS` define o tempo de lease de pasta e arquivo para evitar concorrencia.
- `DRIVE_SYNC_MAX_ATTEMPTS` e `DRIVE_SYNC_RETRY_BASE_MS` controlam retry exponencial para listagem e download.
- `DRIVE_SYNC_ALERT_FAILURE_THRESHOLD` e `DRIVE_SYNC_ALERT_COOLDOWN_SECONDS` controlam quando uma falha recorrente vira alerta operacional.

## Configuracao das pastas monitoradas

Cadastre as pastas monitoradas pelo endpoint admin:

- `GET /api/admin/imports/drive/folders`
- `POST /api/admin/imports/drive/folders`
- `PATCH /api/admin/imports/drive/folders/:id`

Payload de criacao:

```json
{
  "label": "Financeiro Operacional",
  "folderId": "GOOGLE_DRIVE_FOLDER_ID",
  "sharedDriveId": "OPTIONAL_SHARED_DRIVE_ID",
  "enabled": true,
  "templateVersion": "v1"
}
```

## Disparo da sincronizacao

Ha dois modos:

- Admin manual: `POST /api/admin/imports/drive/sync`
- Scheduler externo: `POST /api/import/drive/sync`

Para o scheduler externo, envie:

```http
POST /api/import/drive/sync
x-cron-secret: <CRON_SECRET>
content-type: application/json
```

Body opcional:

```json
{
  "driveImportFolderId": "folder_config_id"
}
```

## Comportamento do sync

- lista arquivos elegiveis na pasta configurada
- ignora arquivos nao Excel
- bloqueia a pasta monitorada com lease no banco antes de sincronizar
- bloqueia cada versao de arquivo (`fileId + modifiedTime`) antes de baixar/importar
- adia arquivos ainda instaveis dentro da janela de debounce
- reaplica retries exponenciais em falhas transitorias de listagem/download
- detecta versoes ja processadas por `externalFileId + externalModifiedTime`
- baixa o binario do arquivo
- envia o arquivo para o mesmo staging usado pelo upload manual
- preserva origem `DRIVE`, `fileId`, `modifiedTime`, pasta e checksum
- mantem coexistencia entre manual + automatico
- registra execucoes operacionais em `DriveSyncRun` e `DriveSyncExecution`
- emite logs estruturados por evento para observabilidade e alertas basicos

## Idempotencia

A sincronizacao trabalha em tres niveis:

1. `externalFileId + externalModifiedTime`
   evita reprocessar a mesma versao remota
2. `ImportFile.checksum`
   evita duplicar conteudo igual no staging
3. `businessKey / rowHash`
   evita duplicacao no publish final
4. lease de pasta e execucao unica por versao de arquivo
   evita processamento simultaneo e reprocessamento indevido em paralelo

## Observabilidade e operacao

- `DriveImportFolder` guarda lease, ultimo status, falhas consecutivas e ultimo alerta emitido.
- `DriveSyncRun` guarda cada execucao da pasta com trigger (`MANUAL` ou `SCHEDULED`), contadores e erro final.
- `DriveSyncExecution` guarda a trilha por arquivo/versao, incluindo retries, deferrals e falhas.
- Os logs sao emitidos em JSON com `scope=drive-sync`, prontos para coletor externo.
- Quando a mesma pasta falha repetidamente acima do threshold configurado, o sistema gera um log de alerta e persiste `lastAlertedAt`.

## Fluxo operacional recomendado

1. Cadastrar uma ou mais pastas monitoradas
2. Configurar o scheduler externo para chamar `/api/import/drive/sync`
3. Acompanhar batches em `/importacoes`
4. Monitorar logs `drive-sync` e tabelas operacionais em caso de falha
5. Publicar lotes validados pelo modulo admin

## Observacao importante

O parser do Excel nao foi duplicado. Toda importacao de Drive converge para o mesmo pipeline de staging ja homologado.
