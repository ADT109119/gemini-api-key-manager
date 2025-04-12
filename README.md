# Gemini API 金鑰管理器


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

繁體中文 | [English](README.en-US.md)

![](image/pic.png)

---

### 簡介

Gemini API 金鑰管理器是一個 Node.js 應用程式，旨在管理和代理 Google Gemini 與 OpenAI 服務的 API 金鑰。它提供了一個 RESTful API 用於金鑰管理，透過負載平衡將請求分發到多個金鑰，並提供一個簡單的網頁管理介面。它也支援代理標準和串流 (Server-Sent Events) API 請求。

**⚠️ 重要警告：本專案無資安防護相關之措施，請僅在本機環境運行。請勿將其部署到公開網路或不受信任的環境中。⚠️**

![介面demo圖片](image/image.png)

### 功能特色

*   **RESTful API：** 管理 API 金鑰（CRUD、批次操作、狀態檢查）。
*   **代理端點：** 將請求代理到 Google Gemini (`/proxy/google`) 和 OpenAI (`/proxy/openai`)。
*   **負載平衡：** 使用 Round-Robin 策略將 API 請求分發到可用的金鑰（跳過暫時無效的金鑰）。
*   **串流支援：** 處理來自 AI 模型的 Server-Sent Events (SSE) 串流回應。
*   **管理介面：** 一個簡單的網頁介面（從 `/` 提供服務），用於查看、新增、刪除和檢查 API 金鑰的狀態。支援批次操作和分頁。
*   **資料持久化：** 將金鑰資訊儲存在 JSON 檔案中（預設：`data/tokens.json`）。
*   **組態設定：** 可透過環境變數高度配置（支援 `.env` 檔案）。
*   **Docker 支援：** 提供 `Dockerfile` 和 `docker-compose.yml`，便於容器化和部署。亦有提供使用 github action 自動部署到 Docker Hub 的映像。
*   **日誌記錄：** 可配置的控制台日誌，用於記錄 API 請求、代理操作和錯誤。

### 專案結構

```
gemini-api-key-manager/
├── .env                # 環境變數（可選，自行複製 .env.example）
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── LICENSE
├── package.json
├── package-lock.json
├── README.md           # 英文版 README
├── README.zh-TW.md     # 本檔案（繁體中文 README）
├── data/               # 資料持久化（儲存 tokens.json）
├── docs/               # 文件和範例
│   └── examples.md
├── public/             # 管理介面的靜態前端檔案
│   ├── index.html
│   └── script.js
├── src/                # 後端原始碼
│   ├── server.js       # 主要 Express 伺服器設定
│   ├── api.js          # API 路由處理器
│   ├── proxy.js        # 代理邏輯處理器
│   ├── tokenStore.js   # 讀寫 tokens.json 的邏輯
│   ├── config.js       # 組態載入
│   └── logger.js       # 日誌記錄工具
└── tests/              # 測試檔案（可選）
```

### 安裝

1.  **克隆儲存庫：**
    ```bash
    git clone https://github.com/ADT109119/gemini-api-key-manager
    cd gemini-api-key-manager
    ```
2.  **安裝依賴：**
    ```bash
    npm install
    ```
3.  **建立 `.env` 檔案（可選）：**
    複製 `.env.example`（如果提供）或在根目錄中建立一個新的 `.env` 檔案以覆蓋預設組態。請參閱 [組態設定](#組態設定) 部分。
4.  **確保 `data` 目錄存在：**
    應用程式會嘗試建立它，但請確保權限允許，或手動建立：
    ```bash
    mkdir data
    ```

### 使用方式

*   **啟動伺服器：**
    ```bash
    npm start
    ```
    伺服器通常會在 `http://localhost:3000` 上運行（或您組態中指定的埠號）。

*   **訪問管理介面：**
    開啟您的網頁瀏覽器並導航至 `http://localhost:3000/`。

*   **使用 API 端點：**
    使用 `curl` 或 Postman 等工具與 API 端點互動。請參閱 [API 端點](#api-端點) 和 `docs/examples.md`。

### 組態設定

使用環境變數或專案根目錄中的 `.env` 檔案來配置應用程式。

*   `PORT`：伺服器監聽的埠號（預設：`3000`）。
*   `DATA_PATH`：用於儲存金鑰資料的 JSON 檔案路徑（預設：`data/tokens.json`）。
*   `LOG_LEVEL`：日誌記錄級別（例如：`info`, `debug`, `warn`, `error`）（預設：`info`）。
*   `GOOGLE_API_ENDPOINT`：Google Gemini API 的基礎 URL。
*   `OPENAI_API_ENDPOINT`：OpenAI API 的基礎 URL。

### API 端點

*   **管理介面：** `GET /` - 提供網頁介面。
*   **金鑰管理：** `GET, POST, DELETE /api/keys` - API 金鑰的 CRUD 操作。支援批次新增/刪除。
    *   `GET /api/keys/status` - 檢查所有金鑰的狀態。
    *   `POST /api/keys/check` - 檢查特定金鑰的狀態。
*   **代理：**
    *   `POST /proxy/google/v1beta/openai/chat/completions` - 將請求代理到 Google Gemini API。
    *   `POST /proxy/openai/v1/chat/completions` - 將請求代理到 OpenAI API。

*(詳細的 API 使用範例請參閱 `docs/examples.md`)*

### 管理介面

基於網頁的管理介面可以輕鬆管理 API 金鑰：

*   查看所有已註冊的金鑰及其狀態。
*   單獨或批次新增金鑰。
*   單獨或批次刪除金鑰。
*   手動觸發金鑰的狀態檢查。
*   針對大量金鑰的基本分頁功能。

### Docker

使用 Docker 建置和運行應用程式：

1.  **建置映像檔：**
    ```bash
    docker build -t gemini-api-key-manager .
    ```
2.  **運行容器：**
    ```bash
    # 範例指令，請視需要調整磁碟區路徑和 .env 檔案
    docker run -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env -d --name gemini-api-key-manager gemini-api-key-manager
    ```
    *   `-p 3000:3000`：將主機埠 3000 映射到容器埠 3000。
    *   `-v $(pwd)/data:/app/data`：將本地 `data` 目錄掛載到容器中以實現持久化。如果您的 data 目錄在其他位置，請調整 `$(pwd)/data`。
    *   `--env-file .env`：（可選）從您的 `.env` 檔案載入環境變數。
    *   `-d`：在分離模式下運行容器。
    *   `--name key-manager`：為容器指定一個名稱。

或者，使用 Docker Compose：

1.  **啟動服務：**
    ```bash
    # 如有必要，請確保更新 docker-compose.yml 中的服務名稱
    docker-compose up -d
    ```
2.  **停止服務：**
    ```bash
    docker-compose down
    ```
    *(請確保 `docker-compose.yml` 配置正確，特別是磁碟區路徑和服務名稱。)*

### 使用預先建置的 Docker 映像檔

您也可以直接使用我在 Docker Hub 上提供的預先建置映像檔來快速啟動應用程式。

[![Docker Image Size (tag)](https://img.shields.io/docker/image-size/adt109119/gemini-api-key-manager/latest)](https://hub.docker.com/r/adt109119/gemini-api-key-manager)

```bash
# 拉取最新映像檔
docker pull adt109119/gemini-api-key-manager:latest

# 運行容器（與上面自行建置的範例類似，但使用預先建置的映像檔名稱）
docker run -p 3000:3000 -v $(pwd)/data:/app/data --env-file .env -d --name gemini-api-key-manager adt109119/gemini-api-key-manager:latest
```
*   請確保根據您的環境調整磁碟區掛載路徑 (`$(pwd)/data`) 和 `.env` 檔案路徑。

## 貢獻

歡迎貢獻！請隨時提交 Pull Request 或開啟 Issue。

## 授權

本專案採用 MIT 授權 - 詳情請參閱 [LICENSE](LICENSE) 檔案。
