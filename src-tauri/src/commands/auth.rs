use crate::db::DbState;
use crate::models::*;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn login(
    db: State<DbState>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, username, password_hash, full_name, role, student_id, created_at FROM users WHERE username = ?1",
        [&username],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
            ))
        },
    );

    match result {
        Ok((id, uname, hash, full_name, role, student_id, created_at)) => {
            let valid = bcrypt::verify(&password, &hash).unwrap_or(false);
            if valid {
                Ok(LoginResponse {
                    user: User {
                        id,
                        username: uname,
                        full_name,
                        role,
                        student_id,
                        created_at,
                    },
                    success: true,
                    message: "Login successful".to_string(),
                })
            } else {
                Ok(LoginResponse {
                    user: User {
                        id: String::new(),
                        username: String::new(),
                        full_name: String::new(),
                        role: String::new(),
                        student_id: None,
                        created_at: String::new(),
                    },
                    success: false,
                    message: "Incorrect password".to_string(),
                })
            }
        }
        Err(_) => Ok(LoginResponse {
            user: User {
                id: String::new(),
                username: String::new(),
                full_name: String::new(),
                role: String::new(),
                student_id: None,
                created_at: String::new(),
            },
            success: false,
            message: "User not found".to_string(),
        }),
    }
}

#[tauri::command]
pub fn register(
    db: State<DbState>,
    username: String,
    password: String,
    full_name: String,
    role: String,
    class_level: Option<String>,
) -> Result<LoginResponse, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;

    // Check if username already exists
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE username = ?1",
            [&username],
            |row| row.get::<_, i32>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if exists {
        return Ok(LoginResponse {
            user: User {
                id: String::new(),
                username: String::new(),
                full_name: String::new(),
                role: String::new(),
                student_id: None,
                created_at: String::new(),
            },
            success: false,
            message: "Username already taken".to_string(),
        });
    }

    let hash = bcrypt::hash(&password, 10).map_err(|e| e.to_string())?;
    let user_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // If student, also create a student record
    let student_id = if role == "student" {
        let sid = Uuid::new_v4().to_string();
        let cl = class_level.unwrap_or_else(|| "Pry 5".to_string());
        conn.execute(
            "INSERT INTO students (id, full_name, class_level) VALUES (?1, ?2, ?3)",
            rusqlite::params![&sid, &full_name, &cl],
        )
        .map_err(|e| e.to_string())?;
        Some(sid)
    } else {
        None
    };

    conn.execute(
        "INSERT INTO users (id, username, password_hash, full_name, role, student_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![&user_id, &username, &hash, &full_name, &role, &student_id, &now],
    )
    .map_err(|e| e.to_string())?;

    Ok(LoginResponse {
        user: User {
            id: user_id,
            username,
            full_name,
            role,
            student_id,
            created_at: now,
        },
        success: true,
        message: "Account created successfully".to_string(),
    })
}

#[tauri::command]
pub fn get_all_users(db: State<DbState>) -> Result<Vec<User>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, username, full_name, role, student_id, created_at FROM users ORDER BY role, full_name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                full_name: row.get(2)?,
                role: row.get(3)?,
                student_id: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut users = Vec::new();
    for row in rows {
        users.push(row.map_err(|e| e.to_string())?);
    }
    Ok(users)
}

#[tauri::command]
pub fn delete_user(db: State<DbState>, user_id: String) -> Result<(), String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM users WHERE id = ?1", [&user_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn enroll_students(
    db: State<DbState>,
    students: Vec<(String, String, String)>, // (full_name, username, class_level)
    default_password: String,
) -> Result<Vec<User>, String> {
    let conn = db.db.lock().map_err(|e| e.to_string())?;
    let hash = bcrypt::hash(&default_password, 10).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let mut enrolled = Vec::new();

    for (full_name, username, class_level) in &students {
        // Check if username exists
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM users WHERE username = ?1",
                [username],
                |row| row.get::<_, i32>(0),
            )
            .map(|c| c > 0)
            .unwrap_or(false);

        if exists {
            continue; // Skip duplicates
        }

        let user_id = Uuid::new_v4().to_string();
        let student_id = Uuid::new_v4().to_string();

        // Create student record
        conn.execute(
            "INSERT INTO students (id, full_name, class_level) VALUES (?1, ?2, ?3)",
            rusqlite::params![&student_id, full_name, class_level],
        )
        .map_err(|e| e.to_string())?;

        // Create user account
        conn.execute(
            "INSERT INTO users (id, username, password_hash, full_name, role, student_id, created_at) VALUES (?1, ?2, ?3, ?4, 'student', ?5, ?6)",
            rusqlite::params![&user_id, username, &hash, full_name, &student_id, &now],
        )
        .map_err(|e| e.to_string())?;

        enrolled.push(User {
            id: user_id,
            username: username.clone(),
            full_name: full_name.clone(),
            role: "student".to_string(),
            student_id: Some(student_id),
            created_at: now.clone(),
        });
    }

    Ok(enrolled)
}
