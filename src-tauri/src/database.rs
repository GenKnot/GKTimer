use serde::{Deserialize, Serialize};
use std::fs;
use crate::models::{WorkSession, WorkSessionCreate, WorkSessionUpdate, WorkSessionSummary, ExportRequest};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkSessionStore {
    pub sessions: Vec<WorkSession>,
}

impl WorkSessionStore {
    pub fn new() -> Self {
        Self { sessions: Vec::new() }
    }

    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let file_path = Self::get_data_file_path()?;
        if file_path.exists() {
            let content = fs::read_to_string(&file_path)?;
            let store: WorkSessionStore = serde_json::from_str(&content)?;
            Ok(store)
        } else {
            Ok(Self::new())
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let file_path = Self::get_data_file_path()?;
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&file_path, content)?;
        Ok(())
    }

    fn get_data_file_path() -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
        let home_dir = std::env::var("HOME").map_err(|_| "Could not find home directory")?;
        let app_dir = std::path::PathBuf::from(home_dir).join(".gktimer");
        let file_path = app_dir.join("work_sessions.json");
        Ok(file_path)
    }
}

pub async fn init_database() -> Result<WorkSessionStore, Box<dyn std::error::Error>> {
    Ok(WorkSessionStore::load()?)
}

pub async fn create_work_session(
    store: &mut WorkSessionStore,
    session: WorkSessionCreate,
) -> Result<WorkSession, Box<dyn std::error::Error>> {
    let id = uuid::Uuid::new_v4().to_string();
    let work_session = WorkSession {
        id: id.clone(),
        start_time: session.start_time,
        end_time: None,
        duration_minutes: None,
        created_at: chrono::Utc::now(),
    };
    
    store.sessions.push(work_session.clone());
    store.save()?;
    Ok(work_session)
}

pub async fn update_work_session(
    store: &mut WorkSessionStore,
    id: &str,
    update: WorkSessionUpdate,
) -> Result<WorkSession, Box<dyn std::error::Error>> {
    let session = store.sessions.iter_mut().find(|s| s.id == id)
        .ok_or("Session not found")?;
    
    let start_time = session.start_time;
    let duration = update.end_time.signed_duration_since(start_time).num_minutes();
    
    session.end_time = Some(update.end_time);
    session.duration_minutes = Some(duration);
    
    let result = session.clone();
    store.save()?;
    Ok(result)
}

pub async fn get_active_session(store: &WorkSessionStore) -> Result<Option<WorkSession>, Box<dyn std::error::Error>> {
    Ok(store.sessions
        .iter()
        .find(|s| s.end_time.is_none())
        .cloned())
}

pub async fn get_work_sessions_by_date_range(
    store: &WorkSessionStore,
    request: ExportRequest,
) -> Result<WorkSessionSummary, Box<dyn std::error::Error>> {
    let sessions: Vec<WorkSession> = store.sessions
        .iter()
        .filter(|session| {
            session.start_time >= request.start_date && session.start_time <= request.end_date
        })
        .cloned()
        .collect();

    let total_duration_minutes: i64 = sessions
        .iter()
        .map(|session| {
            if let Some(duration) = session.duration_minutes {
                duration
            } else if let Some(end_time) = session.end_time {
                end_time.signed_duration_since(session.start_time).num_minutes()
            } else {
                0
            }
        })
        .sum();


    Ok(WorkSessionSummary {
        total_sessions: sessions.len() as i64,
        total_duration_minutes,
        sessions,
    })
}