mod models;
mod database;

use tauri::{command, State};
use chrono::Utc;
use std::sync::Arc;
use tokio::sync::Mutex;
use database::WorkSessionStore;

type DbStore = Arc<Mutex<WorkSessionStore>>;

#[command]
async fn start_timer(store: State<'_, DbStore>) -> Result<models::WorkSession, String> {
    let mut store = store.lock().await;
    let active_session = database::get_active_session(&*store).await.map_err(|e| e.to_string())?;

    if active_session.is_some() {
        return Err("Timer is already running".to_string());
    }

    let session = database::create_work_session(
        &mut *store,
        models::WorkSessionCreate {
            start_time: Utc::now(),
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(session)
}

#[command]
async fn stop_timer(store: State<'_, DbStore>) -> Result<models::WorkSession, String> {
    let mut store = store.lock().await;
    let active_session = database::get_active_session(&*store).await.map_err(|e| e.to_string())?;

    let session = active_session.ok_or("No active timer found")?;

    let updated_session = database::update_work_session(
        &mut *store,
        &session.id,
        models::WorkSessionUpdate {
            end_time: Utc::now(),
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(updated_session)
}

#[command]
async fn get_active_session(store: State<'_, DbStore>) -> Result<Option<models::WorkSession>, String> {
    let store = store.lock().await;
    database::get_active_session(&*store).await.map_err(|e| e.to_string())
}

#[command]
async fn export_work_sessions(
    store: State<'_, DbStore>,
    start_date: String,
    end_date: String,
) -> Result<models::WorkSessionSummary, String> {
    let store = store.lock().await;
    let start_date = chrono::DateTime::parse_from_rfc3339(&start_date)
        .map_err(|e| e.to_string())?
        .with_timezone(&Utc);
    let end_date = chrono::DateTime::parse_from_rfc3339(&end_date)
        .map_err(|e| e.to_string())?
        .with_timezone(&Utc);

    database::get_work_sessions_by_date_range(
        &*store,
        models::ExportRequest {
            start_date,
            end_date,
        },
    )
    .await
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(
            database::init_database().expect("Failed to initialize database")
        )))
        .invoke_handler(tauri::generate_handler![
            start_timer,
            stop_timer,
            get_active_session,
            export_work_sessions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
