use rusqlite::Connection;

/// Seed the database with initial curriculum data if empty.
pub fn seed_if_empty(conn: &Connection) -> Result<(), String> {
    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM subjects", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Ok(()); // Already seeded
    }

    // Seed students FIRST (users table has FK to students)
    conn.execute_batch(
        "INSERT INTO students (id, full_name, class_level, streak_days, total_points) VALUES
            ('s1', 'Amina Johnson', 'Pry 5', 0, 0),
            ('s2', 'David Okonkwo', 'Pry 5', 0, 0),
            ('s3', 'Grace Peters', 'Pry 6', 0, 0),
            ('s4', 'Samuel Kehinde', 'Pry 6', 0, 0),
            ('s5', 'Fatima Bello', 'JSS1', 0, 0);",
    ).map_err(|e| format!("Failed to seed students: {}", e))?;

    // Seed default teacher account (password: "teacher123")
    let teacher_hash = bcrypt::hash("teacher123", 10).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO users (id, username, password_hash, full_name, role) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params!["user-teacher-1", "teacher", &teacher_hash, "Mr. Emmanuel", "teacher"],
    ).map_err(|e| e.to_string())?;

    // Seed student user accounts (password: "student123")
    let student_hash = bcrypt::hash("student123", 10).map_err(|e| e.to_string())?;
    let sample_students = vec![
        ("user-s1", "amina", "Amina Johnson", "s1"),
        ("user-s2", "david", "David Okonkwo", "s2"),
        ("user-s3", "grace", "Grace Peters", "s3"),
        ("user-s4", "samuel", "Samuel Kehinde", "s4"),
        ("user-s5", "fatima", "Fatima Bello", "s5"),
    ];
    for (uid, uname, fname, sid) in &sample_students {
        conn.execute(
            "INSERT INTO users (id, username, password_hash, full_name, role, student_id) VALUES (?1, ?2, ?3, ?4, 'student', ?5)",
            rusqlite::params![uid, uname, &student_hash, fname, sid],
        ).map_err(|e| e.to_string())?;
    }

    // Seed subjects and topics
    conn.execute_batch(
        "
        -- ══════════════════════════════════════════════════════════════
        -- SUBJECTS: Full Nigerian Curriculum (Pry 5 to SS3)
        -- ══════════════════════════════════════════════════════════════

        -- Mathematics
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('maths-pry5', 'Mathematics', 'calculator', 'Pry 5', 'Pry 5 Mathematics covering whole numbers, fractions, and basic measurement'),
            ('maths-pry6', 'Mathematics', 'calculator', 'Pry 6', 'Pry 6 Mathematics covering decimals, percentages, and basic geometry'),
            ('maths-jss1', 'Mathematics', 'calculator', 'JSS1', 'JSS1 Mathematics covering number bases, fractions, and basic algebra'),
            ('maths-jss2', 'Mathematics', 'calculator', 'JSS2', 'JSS2 Mathematics covering algebraic expressions, linear equations, and geometry'),
            ('maths-jss3', 'Mathematics', 'calculator', 'JSS3', 'JSS3 Mathematics covering simultaneous equations, quadratics, and statistics'),
            ('maths-ss1', 'Mathematics', 'calculator', 'SS1', 'SS1 Mathematics covering sets, logarithms, and trigonometry'),
            ('maths-ss2', 'Mathematics', 'calculator', 'SS2', 'SS2 Mathematics covering quadratic equations, matrices, and differentiation'),
            ('maths-ss3', 'Mathematics', 'calculator', 'SS3', 'SS3 Mathematics covering integration, probability, and revision');

        -- English
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('eng-pry5', 'English', 'book-open', 'Pry 5', 'Pry 5 English covering reading, vocabulary, and sentence construction'),
            ('eng-pry6', 'English', 'book-open', 'Pry 6', 'Pry 6 English covering composition, comprehension, and basic grammar'),
            ('eng-jss1', 'English', 'book-open', 'JSS1', 'JSS1 English covering parts of speech, sentence structure, and comprehension'),
            ('eng-jss2', 'English', 'book-open', 'JSS2', 'JSS2 English covering tenses, essay writing, and literature'),
            ('eng-jss3', 'English', 'book-open', 'JSS3', 'JSS3 English covering advanced grammar, creative writing, and oral English'),
            ('eng-ss1', 'English', 'book-open', 'SS1', 'SS1 English covering literary devices, summary writing, and speech'),
            ('eng-ss2', 'English', 'book-open', 'SS2', 'SS2 English covering advanced essay types, figurative language, and drama'),
            ('eng-ss3', 'English', 'book-open', 'SS3', 'SS3 English covering exam prep, oral English, and literature');

        -- Basic Science / Biology / Chemistry / Physics
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('sci-pry5', 'Basic Science', 'flask-conical', 'Pry 5', 'Pry 5 Basic Science covering living things, the human body, and simple machines'),
            ('sci-pry6', 'Basic Science', 'flask-conical', 'Pry 6', 'Pry 6 Basic Science covering water cycle, soil, and basic health'),
            ('sci-jss1', 'Basic Science', 'flask-conical', 'JSS1', 'JSS1 Basic Science covering living and non-living things, measurement, and the human body'),
            ('sci-jss2', 'Basic Science', 'flask-conical', 'JSS2', 'JSS2 Basic Science covering photosynthesis, energy, and the solar system'),
            ('sci-jss3', 'Basic Science', 'flask-conical', 'JSS3', 'JSS3 Basic Science covering acids and bases, reproduction, and ecology'),
            ('bio-ss1', 'Biology', 'flask-conical', 'SS1', 'SS1 Biology covering cell structure, classification, and ecology'),
            ('bio-ss2', 'Biology', 'flask-conical', 'SS2', 'SS2 Biology covering genetics, evolution, and human physiology'),
            ('bio-ss3', 'Biology', 'flask-conical', 'SS3', 'SS3 Biology covering ecology, biotechnology, and revision'),
            ('chem-ss1', 'Chemistry', 'flask-conical', 'SS1', 'SS1 Chemistry covering atomic structure, chemical bonding, and states of matter'),
            ('chem-ss2', 'Chemistry', 'flask-conical', 'SS2', 'SS2 Chemistry covering acids, bases, electrolysis, and organic chemistry'),
            ('chem-ss3', 'Chemistry', 'flask-conical', 'SS3', 'SS3 Chemistry covering industrial chemistry, quantitative analysis, and revision'),
            ('phy-ss1', 'Physics', 'flask-conical', 'SS1', 'SS1 Physics covering measurement, motion, energy, and waves'),
            ('phy-ss2', 'Physics', 'flask-conical', 'SS2', 'SS2 Physics covering electricity, magnetism, and optics'),
            ('phy-ss3', 'Physics', 'flask-conical', 'SS3', 'SS3 Physics covering modern physics, nuclear energy, and revision');

        -- Social Studies / Government
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('soc-pry5', 'Social Studies', 'globe', 'Pry 5', 'Pry 5 Social Studies covering family, community, and Nigerian culture'),
            ('soc-pry6', 'Social Studies', 'globe', 'Pry 6', 'Pry 6 Social Studies covering government, citizenship, and national symbols'),
            ('soc-jss1', 'Social Studies', 'globe', 'JSS1', 'JSS1 Social Studies covering Nigerian geography, culture, and citizenship'),
            ('soc-jss2', 'Social Studies', 'globe', 'JSS2', 'JSS2 Social Studies covering national development, social problems, and values'),
            ('soc-jss3', 'Social Studies', 'globe', 'JSS3', 'JSS3 Social Studies covering democracy, human rights, and drug abuse'),
            ('gov-ss1', 'Government', 'globe', 'SS1', 'SS1 Government covering basic concepts, constitution, and organs of government'),
            ('gov-ss2', 'Government', 'globe', 'SS2', 'SS2 Government covering federalism, political parties, and elections'),
            ('gov-ss3', 'Government', 'globe', 'SS3', 'SS3 Government covering international organizations and Nigerian foreign policy');

        -- Basic Technology
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('tech-jss1', 'Basic Technology', 'wrench', 'JSS1', 'JSS1 Basic Technology covering tools, materials, and technical drawing'),
            ('tech-jss2', 'Basic Technology', 'wrench', 'JSS2', 'JSS2 Basic Technology covering woodwork, metalwork, and electrical circuits'),
            ('tech-jss3', 'Basic Technology', 'wrench', 'JSS3', 'JSS3 Basic Technology covering building construction, engines, and energy');

        -- Civic Education
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('civic-jss1', 'Civic Education', 'globe', 'JSS1', 'JSS1 Civic Education covering values, citizenship, and human rights'),
            ('civic-jss2', 'Civic Education', 'globe', 'JSS2', 'JSS2 Civic Education covering democracy, national unity, and rule of law'),
            ('civic-jss3', 'Civic Education', 'globe', 'JSS3', 'JSS3 Civic Education covering constitution, elections, and civic responsibilities'),
            ('civic-ss1', 'Civic Education', 'globe', 'SS1', 'SS1 Civic Education covering national values, human rights, and HIV/AIDS'),
            ('civic-ss2', 'Civic Education', 'globe', 'SS2', 'SS2 Civic Education covering democratic processes, anti-corruption, and youth empowerment'),
            ('civic-ss3', 'Civic Education', 'globe', 'SS3', 'SS3 Civic Education covering public service, civil society, and revision');

        -- Economics
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('econ-ss1', 'Economics', 'calculator', 'SS1', 'SS1 Economics covering basic concepts, demand and supply, and production'),
            ('econ-ss2', 'Economics', 'calculator', 'SS2', 'SS2 Economics covering money, banking, trade, and national income'),
            ('econ-ss3', 'Economics', 'calculator', 'SS3', 'SS3 Economics covering public finance, international trade, and development');

        -- Agricultural Science
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('agric-jss1', 'Agricultural Science', 'flask-conical', 'JSS1', 'JSS1 Agric covering meaning of agriculture, soil, and farm tools'),
            ('agric-jss2', 'Agricultural Science', 'flask-conical', 'JSS2', 'JSS2 Agric covering crop production, animal husbandry, and pest control'),
            ('agric-jss3', 'Agricultural Science', 'flask-conical', 'JSS3', 'JSS3 Agric covering food processing, marketing, and farm management');

        -- Computer Studies / ICT
        INSERT INTO subjects (id, name, icon, class_level, description) VALUES
            ('ict-jss1', 'Computer Studies', 'wrench', 'JSS1', 'JSS1 Computer Studies covering hardware, software, and basic operations'),
            ('ict-jss2', 'Computer Studies', 'wrench', 'JSS2', 'JSS2 Computer Studies covering word processing, spreadsheets, and the internet'),
            ('ict-jss3', 'Computer Studies', 'wrench', 'JSS3', 'JSS3 Computer Studies covering databases, programming concepts, and web basics');

        -- ══════════════════════════════════════════════════════════════
        -- TOPICS
        -- ══════════════════════════════════════════════════════════════

        -- Mathematics Pry 5 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('maths-pry5-t1', 'maths-pry5', 'Whole Numbers', 'Place value, ordering, and rounding whole numbers', 1, 0, 35),
            ('maths-pry5-t2', 'maths-pry5', 'Addition and Subtraction', 'Adding and subtracting large numbers', 2, 1, 30),
            ('maths-pry5-t3', 'maths-pry5', 'Multiplication and Division', 'Multiplying and dividing by 2-digit numbers', 3, 1, 35),
            ('maths-pry5-t4', 'maths-pry5', 'Fractions', 'Proper fractions, equivalent fractions, and simple operations', 4, 1, 40),
            ('maths-pry5-t5', 'maths-pry5', 'Measurement', 'Length, mass, capacity, and unit conversion', 5, 1, 35),
            ('maths-pry5-t6', 'maths-pry5', 'Shapes and Geometry', 'Properties of 2D and 3D shapes', 6, 1, 30),
            ('maths-pry5-t7', 'maths-pry5', 'Money', 'Nigerian currency, buying and selling, profit and loss', 7, 1, 25),
            ('maths-pry5-t8', 'maths-pry5', 'Time', 'Reading clocks, calendars, and time calculations', 8, 1, 25);

        -- Mathematics Pry 6 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('maths-pry6-t1', 'maths-pry6', 'Decimals', 'Reading, writing, and operations with decimals', 1, 1, 35),
            ('maths-pry6-t2', 'maths-pry6', 'Percentages', 'Converting fractions to percentages and vice versa', 2, 1, 30),
            ('maths-pry6-t3', 'maths-pry6', 'Ratio and Proportion', 'Sharing quantities in given ratios', 3, 1, 35),
            ('maths-pry6-t4', 'maths-pry6', 'Perimeter and Area', 'Calculating perimeter and area of shapes', 4, 1, 40),
            ('maths-pry6-t5', 'maths-pry6', 'Data Handling', 'Collecting, organizing, and interpreting data', 5, 1, 30),
            ('maths-pry6-t6', 'maths-pry6', 'Angles', 'Types of angles, measuring and drawing angles', 6, 1, 35);

        -- Mathematics JSS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('maths-jss1-t1', 'maths-jss1', 'Whole Numbers', 'Place value, ordering, and operations with whole numbers', 1, 0, 40),
            ('maths-jss1-t2', 'maths-jss1', 'Basic Operations', 'Addition, subtraction, multiplication, and division', 2, 1, 35),
            ('maths-jss1-t3', 'maths-jss1', 'Factors and Multiples', 'HCF, LCM, prime numbers, and factorization', 3, 1, 45),
            ('maths-jss1-t4', 'maths-jss1', 'Fractions', 'Types of fractions and basic operations', 4, 1, 40),
            ('maths-jss1-t5', 'maths-jss1', 'Decimals and Percentages', 'Converting and computing with decimals and percentages', 5, 1, 40),
            ('maths-jss1-t6', 'maths-jss1', 'Basic Algebra', 'Introduction to algebraic expressions and simple equations', 6, 1, 45),
            ('maths-jss1-t7', 'maths-jss1', 'Geometry Basics', 'Lines, angles, and simple shapes', 7, 1, 35),
            ('maths-jss1-t8', 'maths-jss1', 'Statistics', 'Frequency tables, bar charts, and pie charts', 8, 1, 35);

        -- Mathematics JSS2 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('maths-jss2-t1', 'maths-jss2', 'Number Bases', 'Converting between number bases (base 2, 5, 8, 10)', 1, 0, 45),
            ('maths-jss2-t2', 'maths-jss2', 'Fractions and Decimals', 'Operations with fractions and decimal numbers', 2, 1, 40),
            ('maths-jss2-t3', 'maths-jss2', 'Algebraic Expressions', 'Simplifying and evaluating algebraic expressions', 3, 1, 50),
            ('maths-jss2-t4', 'maths-jss2', 'Linear Equations', 'Solving linear equations in one variable', 4, 1, 45),
            ('maths-jss2-t5', 'maths-jss2', 'Geometry', 'Properties of triangles, quadrilaterals, and circles', 5, 1, 50),
            ('maths-jss2-t6', 'maths-jss2', 'Statistics', 'Mean, median, mode, and data representation', 6, 1, 40),
            ('maths-jss2-t7', 'maths-jss2', 'Mensuration', 'Area and perimeter of circles and composite shapes', 7, 1, 45),
            ('maths-jss2-t8', 'maths-jss2', 'Ratio and Proportion', 'Direct and inverse proportion, sharing', 8, 1, 35);

        -- Mathematics JSS3 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('maths-jss3-t1', 'maths-jss3', 'Simultaneous Equations', 'Solving simultaneous linear equations', 1, 1, 50),
            ('maths-jss3-t2', 'maths-jss3', 'Quadratic Equations', 'Introduction to quadratic expressions and equations', 2, 1, 50),
            ('maths-jss3-t3', 'maths-jss3', 'Indices and Logarithms', 'Laws of indices and introduction to logarithms', 3, 1, 45),
            ('maths-jss3-t4', 'maths-jss3', 'Trigonometry', 'Sine, cosine, tangent for right-angled triangles', 4, 1, 50),
            ('maths-jss3-t5', 'maths-jss3', 'Statistics and Probability', 'Probability of events and grouped data', 5, 1, 40),
            ('maths-jss3-t6', 'maths-jss3', 'Variation', 'Direct and inverse variation', 6, 1, 40);

        -- Mathematics SS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('maths-ss1-t1', 'maths-ss1', 'Number Bases', 'Operations in different number bases', 1, 1, 45),
            ('maths-ss1-t2', 'maths-ss1', 'Modular Arithmetic', 'Clock arithmetic and modular operations', 2, 1, 40),
            ('maths-ss1-t3', 'maths-ss1', 'Sets', 'Set notation, Venn diagrams, and operations', 3, 1, 50),
            ('maths-ss1-t4', 'maths-ss1', 'Logarithms', 'Laws of logarithms and calculations', 4, 1, 50),
            ('maths-ss1-t5', 'maths-ss1', 'Quadratic Equations', 'Factoring, completing the square, formula method', 5, 1, 55),
            ('maths-ss1-t6', 'maths-ss1', 'Trigonometry', 'Trigonometric ratios and special angles', 6, 1, 50);

        -- Mathematics SS2 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('maths-ss2-t1', 'maths-ss2', 'Surds', 'Simplification of surds and rationalisation', 1, 1, 45),
            ('maths-ss2-t2', 'maths-ss2', 'Matrices', 'Matrix operations, determinants, and inverse', 2, 1, 50),
            ('maths-ss2-t3', 'maths-ss2', 'Differentiation', 'First principles, polynomial differentiation', 3, 1, 55),
            ('maths-ss2-t4', 'maths-ss2', 'Coordinate Geometry', 'Straight line equations, distance, and midpoint', 4, 1, 45),
            ('maths-ss2-t5', 'maths-ss2', 'Sequence and Series', 'Arithmetic and geometric progressions', 5, 1, 50),
            ('maths-ss2-t6', 'maths-ss2', 'Probability', 'Probability rules, conditional probability', 6, 1, 45);

        -- English Pry 5 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('eng-pry5-t1', 'eng-pry5', 'Reading Comprehension', 'Reading passages and answering questions', 1, 1, 35),
            ('eng-pry5-t2', 'eng-pry5', 'Vocabulary Building', 'New words, meanings, and usage in context', 2, 1, 30),
            ('eng-pry5-t3', 'eng-pry5', 'Sentence Construction', 'Building correct sentences with subjects and predicates', 3, 1, 30),
            ('eng-pry5-t4', 'eng-pry5', 'Nouns and Pronouns', 'Types of nouns and pronoun usage', 4, 1, 25),
            ('eng-pry5-t5', 'eng-pry5', 'Verbs and Tenses', 'Action words and simple tenses', 5, 1, 30),
            ('eng-pry5-t6', 'eng-pry5', 'Story Writing', 'Writing simple narratives and stories', 6, 1, 35);

        -- English Pry 6 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('eng-pry6-t1', 'eng-pry6', 'Composition Writing', 'Descriptive and narrative essays', 1, 1, 40),
            ('eng-pry6-t2', 'eng-pry6', 'Comprehension', 'Advanced reading passages', 2, 1, 35),
            ('eng-pry6-t3', 'eng-pry6', 'Grammar: Parts of Speech', 'Adjectives, adverbs, prepositions, conjunctions', 3, 1, 35),
            ('eng-pry6-t4', 'eng-pry6', 'Letter Writing', 'Informal and semi-formal letter writing', 4, 1, 30),
            ('eng-pry6-t5', 'eng-pry6', 'Punctuation', 'Full stops, commas, question marks, and quotation marks', 5, 1, 25);

        -- English JSS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('eng-jss1-t1', 'eng-jss1', 'Parts of Speech', 'Nouns, verbs, adjectives, adverbs, and pronouns', 1, 0, 40),
            ('eng-jss1-t2', 'eng-jss1', 'Sentence Structure', 'Subject, predicate, types of sentences', 2, 1, 35),
            ('eng-jss1-t3', 'eng-jss1', 'Comprehension', 'Reading passages and answering questions', 3, 1, 45),
            ('eng-jss1-t4', 'eng-jss1', 'Composition', 'Descriptive and narrative essay writing', 4, 1, 50),
            ('eng-jss1-t5', 'eng-jss1', 'Vowel and Consonant Sounds', 'English phonetics and pronunciation', 5, 1, 35),
            ('eng-jss1-t6', 'eng-jss1', 'Vocabulary Development', 'Word formation, synonyms, and antonyms', 6, 1, 30);

        -- English JSS2 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('eng-jss2-t1', 'eng-jss2', 'Tenses', 'Present, past, and future tenses with perfect forms', 1, 1, 40),
            ('eng-jss2-t2', 'eng-jss2', 'Essay Writing', 'Argumentative, descriptive, and narrative essays', 2, 1, 50),
            ('eng-jss2-t3', 'eng-jss2', 'Literature', 'Introduction to prose, poetry, and drama', 3, 1, 45),
            ('eng-jss2-t4', 'eng-jss2', 'Summary Writing', 'Summarizing passages in own words', 4, 1, 40),
            ('eng-jss2-t5', 'eng-jss2', 'Clauses and Phrases', 'Independent and dependent clauses', 5, 1, 35),
            ('eng-jss2-t6', 'eng-jss2', 'Speech Work', 'Stress patterns and intonation', 6, 1, 30);

        -- English JSS3 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('eng-jss3-t1', 'eng-jss3', 'Advanced Grammar', 'Active/passive voice, reported speech', 1, 1, 45),
            ('eng-jss3-t2', 'eng-jss3', 'Creative Writing', 'Short stories, poems, and dialogues', 2, 1, 50),
            ('eng-jss3-t3', 'eng-jss3', 'Oral English', 'Pronunciation, stress, intonation patterns', 3, 1, 35),
            ('eng-jss3-t4', 'eng-jss3', 'Formal Letter Writing', 'Writing formal and official letters', 4, 1, 40),
            ('eng-jss3-t5', 'eng-jss3', 'Comprehension and Summary', 'Exam-level comprehension and summary', 5, 1, 45);

        -- Basic Science Pry 5 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('sci-pry5-t1', 'sci-pry5', 'Living Things', 'Characteristics of living things and their classification', 1, 1, 30),
            ('sci-pry5-t2', 'sci-pry5', 'The Human Body', 'Basic body parts and their functions', 2, 1, 35),
            ('sci-pry5-t3', 'sci-pry5', 'Simple Machines', 'Lever, pulley, inclined plane, and wheel', 3, 1, 30),
            ('sci-pry5-t4', 'sci-pry5', 'Air and Water', 'Properties of air and water, uses and conservation', 4, 1, 25),
            ('sci-pry5-t5', 'sci-pry5', 'Healthy Living', 'Personal hygiene, balanced diet, and exercise', 5, 1, 25);

        -- Basic Science Pry 6 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('sci-pry6-t1', 'sci-pry6', 'Water Cycle', 'Evaporation, condensation, and precipitation', 1, 1, 30),
            ('sci-pry6-t2', 'sci-pry6', 'Soil Types', 'Sandy, clay, loamy soil and their properties', 2, 1, 25),
            ('sci-pry6-t3', 'sci-pry6', 'Changes of State', 'Melting, freezing, boiling, and condensation', 3, 1, 30),
            ('sci-pry6-t4', 'sci-pry6', 'Food and Nutrition', 'Classes of food, balanced diet, deficiency diseases', 4, 1, 35),
            ('sci-pry6-t5', 'sci-pry6', 'The Environment', 'Pollution, conservation, and waste management', 5, 1, 30);

        -- Basic Science JSS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('sci-jss1-t1', 'sci-jss1', 'Living and Non-Living Things', 'Characteristics, classification, and differences', 1, 1, 35),
            ('sci-jss1-t2', 'sci-jss1', 'Measurement', 'Units of measurement, tools, and accuracy', 2, 1, 30),
            ('sci-jss1-t3', 'sci-jss1', 'The Human Body Systems', 'Skeletal, muscular, and digestive systems', 3, 1, 45),
            ('sci-jss1-t4', 'sci-jss1', 'Matter', 'States of matter, properties, and changes', 4, 1, 35),
            ('sci-jss1-t5', 'sci-jss1', 'Plant Biology', 'Parts of a plant, germination, and photosynthesis', 5, 1, 40);

        -- Basic Science JSS2 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('sci-jss2-t1', 'sci-jss2', 'Photosynthesis', 'How green plants make food using sunlight', 1, 0, 40),
            ('sci-jss2-t2', 'sci-jss2', 'The Solar System', 'Planets, the sun, and celestial bodies', 2, 1, 45),
            ('sci-jss2-t3', 'sci-jss2', 'Energy', 'Forms of energy and energy transformation', 3, 1, 40),
            ('sci-jss2-t4', 'sci-jss2', 'Reproduction', 'Reproduction in plants and animals', 4, 1, 40),
            ('sci-jss2-t5', 'sci-jss2', 'Force and Motion', 'Types of forces, friction, and speed', 5, 1, 35);

        -- Basic Science JSS3 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('sci-jss3-t1', 'sci-jss3', 'Acids, Bases and Salts', 'pH scale, indicators, and neutralisation', 1, 1, 40),
            ('sci-jss3-t2', 'sci-jss3', 'Reproduction in Humans', 'Male and female reproductive systems', 2, 1, 45),
            ('sci-jss3-t3', 'sci-jss3', 'Ecology', 'Ecosystems, food chains, and environmental conservation', 3, 1, 40),
            ('sci-jss3-t4', 'sci-jss3', 'Electricity', 'Simple circuits, conductors, and insulators', 4, 1, 35),
            ('sci-jss3-t5', 'sci-jss3', 'STIs and HIV/AIDS', 'Sexually transmitted infections, prevention, and awareness', 5, 1, 30);

        -- Biology SS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('bio-ss1-t1', 'bio-ss1', 'Cell Structure', 'Plant and animal cells, organelles, and cell division', 1, 1, 50),
            ('bio-ss1-t2', 'bio-ss1', 'Classification of Living Things', 'Five kingdoms and binomial nomenclature', 2, 1, 45),
            ('bio-ss1-t3', 'bio-ss1', 'Ecology', 'Biomes, habitats, population, and community', 3, 1, 50),
            ('bio-ss1-t4', 'bio-ss1', 'Nutrition', 'Autotrophic and heterotrophic nutrition', 4, 1, 40),
            ('bio-ss1-t5', 'bio-ss1', 'Transport in Living Things', 'Diffusion, osmosis, and active transport', 5, 1, 45);

        -- Chemistry SS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('chem-ss1-t1', 'chem-ss1', 'Nature of Matter', 'Atoms, molecules, and the kinetic theory', 1, 1, 45),
            ('chem-ss1-t2', 'chem-ss1', 'Atomic Structure', 'Protons, neutrons, electrons, and electronic configuration', 2, 1, 50),
            ('chem-ss1-t3', 'chem-ss1', 'Chemical Bonding', 'Ionic, covalent, and metallic bonding', 3, 1, 50),
            ('chem-ss1-t4', 'chem-ss1', 'States of Matter', 'Gases, liquids, solids, and changes of state', 4, 1, 40),
            ('chem-ss1-t5', 'chem-ss1', 'The Periodic Table', 'Groups, periods, and trends in properties', 5, 1, 45);

        -- Physics SS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('phy-ss1-t1', 'phy-ss1', 'Measurement', 'Physical quantities, SI units, and instruments', 1, 1, 40),
            ('phy-ss1-t2', 'phy-ss1', 'Scalars and Vectors', 'Types of quantities, resultant forces', 2, 1, 35),
            ('phy-ss1-t3', 'phy-ss1', 'Motion', 'Speed, velocity, acceleration, and equations of motion', 3, 1, 50),
            ('phy-ss1-t4', 'phy-ss1', 'Energy', 'Forms of energy, conservation, work, and power', 4, 1, 45),
            ('phy-ss1-t5', 'phy-ss1', 'Waves', 'Types of waves, properties, and sound', 5, 1, 50);

        -- Social Studies Pry 5 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('soc-pry5-t1', 'soc-pry5', 'Family', 'Types of family, roles, and responsibilities', 1, 1, 25),
            ('soc-pry5-t2', 'soc-pry5', 'Community', 'Our community, leaders, and services', 2, 1, 25),
            ('soc-pry5-t3', 'soc-pry5', 'Nigerian Culture', 'Festivals, food, and traditional values', 3, 1, 30),
            ('soc-pry5-t4', 'soc-pry5', 'Transportation', 'Means of transport and road safety', 4, 1, 25);

        -- Social Studies JSS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('soc-jss1-t1', 'soc-jss1', 'Nigerian Geography', 'Location, states, capitals, and vegetation zones', 1, 1, 40),
            ('soc-jss1-t2', 'soc-jss1', 'Culture and Socialisation', 'Nigerian ethnic groups, customs, and values', 2, 1, 35),
            ('soc-jss1-t3', 'soc-jss1', 'Citizenship', 'Rights and duties of Nigerian citizens', 3, 1, 30),
            ('soc-jss1-t4', 'soc-jss1', 'Social Problems', 'Drug abuse, HIV/AIDS, and crime prevention', 4, 1, 35);

        -- Social Studies JSS2 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('soc-jss2-t1', 'soc-jss2', 'National Development', 'Factors affecting development in Nigeria', 1, 1, 40),
            ('soc-jss2-t2', 'soc-jss2', 'Social Problems', 'Poverty, unemployment, and inequality', 2, 1, 35),
            ('soc-jss2-t3', 'soc-jss2', 'National Unity', 'Inter-ethnic relations and national symbols', 3, 1, 30),
            ('soc-jss2-t4', 'soc-jss2', 'Human Rights', 'Fundamental human rights and responsibilities', 4, 1, 35);

        -- Civic Education JSS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('civic-jss1-t1', 'civic-jss1', 'Values', 'Honesty, integrity, courage, and contentment', 1, 1, 30),
            ('civic-jss1-t2', 'civic-jss1', 'Citizenship', 'Who is a citizen, how to acquire citizenship', 2, 1, 30),
            ('civic-jss1-t3', 'civic-jss1', 'Human Rights', 'Fundamental rights and their limitations', 3, 1, 35),
            ('civic-jss1-t4', 'civic-jss1', 'Rule of Law', 'Meaning, importance, and limitations', 4, 1, 30);

        -- Economics SS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('econ-ss1-t1', 'econ-ss1', 'Basic Economic Concepts', 'Scarcity, choice, scale of preference, opportunity cost', 1, 1, 40),
            ('econ-ss1-t2', 'econ-ss1', 'Demand and Supply', 'Law of demand and supply, equilibrium price', 2, 1, 45),
            ('econ-ss1-t3', 'econ-ss1', 'Production', 'Factors of production: land, labour, capital, entrepreneur', 3, 1, 40),
            ('econ-ss1-t4', 'econ-ss1', 'Market Structure', 'Perfect competition, monopoly, oligopoly', 4, 1, 45),
            ('econ-ss1-t5', 'econ-ss1', 'National Income', 'GDP, GNP, and methods of calculation', 5, 1, 40);

        -- Computer Studies JSS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('ict-jss1-t1', 'ict-jss1', 'Introduction to Computers', 'History, generations, and types of computers', 1, 1, 30),
            ('ict-jss1-t2', 'ict-jss1', 'Computer Hardware', 'Input, output, and storage devices', 2, 1, 35),
            ('ict-jss1-t3', 'ict-jss1', 'Computer Software', 'System software, application software, and operating systems', 3, 1, 35),
            ('ict-jss1-t4', 'ict-jss1', 'Basic Computer Operations', 'Booting, using the keyboard and mouse', 4, 1, 25),
            ('ict-jss1-t5', 'ict-jss1', 'Data and Information', 'Types of data, data processing, and information', 5, 1, 30);

        -- Agricultural Science JSS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('agric-jss1-t1', 'agric-jss1', 'Meaning of Agriculture', 'Definition, importance, and branches of agriculture', 1, 1, 25),
            ('agric-jss1-t2', 'agric-jss1', 'Soil', 'Types of soil, soil profile, and soil conservation', 2, 1, 35),
            ('agric-jss1-t3', 'agric-jss1', 'Farm Tools', 'Simple farm tools, their uses and maintenance', 3, 1, 30),
            ('agric-jss1-t4', 'agric-jss1', 'Crop Production', 'Land preparation, planting, and harvesting', 4, 1, 40);

        -- Basic Technology JSS1 Topics
        INSERT INTO topics (id, subject_id, name, description, sort_order, is_locked, estimated_minutes) VALUES
            ('tech-jss1-t1', 'tech-jss1', 'Technology and Society', 'Impact of technology on everyday life', 1, 1, 25),
            ('tech-jss1-t2', 'tech-jss1', 'Workshop Safety', 'Safety rules, first aid, and workshop practices', 2, 1, 30),
            ('tech-jss1-t3', 'tech-jss1', 'Materials and Tools', 'Types of materials: wood, metal, plastic', 3, 1, 35),
            ('tech-jss1-t4', 'tech-jss1', 'Technical Drawing', 'Lines, lettering, and geometric constructions', 4, 1, 40);

        -- ══════════════════════════════════════════════════════════════
        -- QUESTIONS (expanded)
        -- ══════════════════════════════════════════════════════════════

        -- Mathematics: Whole Numbers (Pry 5)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q-mp5-1', 'maths-pry5-t1', 'What is the place value of 5 in 3,567?', 'mcq', '[\"5\", \"50\", \"500\", \"5000\"]', '500', 'The 5 is in the hundreds place, so its place value is 500.', 1),
            ('q-mp5-2', 'maths-pry5-t1', 'Arrange in ascending order: 4532, 3245, 5342, 2345', 'mcq', '[\"2345, 3245, 4532, 5342\", \"5342, 4532, 3245, 2345\", \"3245, 2345, 4532, 5342\", \"2345, 4532, 3245, 5342\"]', '2345, 3245, 4532, 5342', 'Ascending order means from smallest to largest.', 1),
            ('q-mp5-3', 'maths-pry5-t1', 'Round 6,847 to the nearest hundred.', 'mcq', '[\"6,800\", \"6,900\", \"6,850\", \"7,000\"]', '6,800', 'Look at the tens digit (4). Since 4 < 5, round down to 6,800.', 2),
            ('q-mp5-4', 'maths-pry5-t1', 'What number is 1000 more than 45,672?', 'mcq', '[\"46,672\", \"55,672\", \"45,772\", \"46,672\"]', '46,672', 'Add 1000 to 45,672: 45,672 + 1,000 = 46,672.', 1),
            ('q-mp5-5', 'maths-pry5-t1', 'Which is the largest: 9,999 or 10,001?', 'mcq', '[\"9,999\", \"10,001\", \"They are equal\", \"Cannot tell\"]', '10,001', '10,001 has 5 digits while 9,999 has 4 digits. 10,001 is larger.', 1);

        -- Mathematics: Fractions (Pry 5)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q-mp5-f1', 'maths-pry5-t4', 'What is 1/2 + 1/4?', 'mcq', '[\"2/6\", \"3/4\", \"1/6\", \"2/4\"]', '3/4', 'Convert 1/2 to 2/4, then add: 2/4 + 1/4 = 3/4.', 1),
            ('q-mp5-f2', 'maths-pry5-t4', 'Which fraction is equivalent to 2/4?', 'mcq', '[\"1/2\", \"3/4\", \"2/3\", \"4/2\"]', '1/2', 'Divide both numerator and denominator by 2: 2/4 = 1/2.', 1),
            ('q-mp5-f3', 'maths-pry5-t4', 'What is 3/5 of 20?', 'mcq', '[\"10\", \"12\", \"15\", \"8\"]', '12', '3/5 of 20 = (3 × 20) ÷ 5 = 60 ÷ 5 = 12.', 2),
            ('q-mp5-f4', 'maths-pry5-t4', 'Simplify the fraction 6/8.', 'mcq', '[\"3/4\", \"2/3\", \"4/6\", \"1/2\"]', '3/4', 'Divide both by 2: 6÷2 = 3, 8÷2 = 4. So 6/8 = 3/4.', 1),
            ('q-mp5-f5', 'maths-pry5-t4', 'Which is greater: 2/3 or 3/5?', 'mcq', '[\"2/3\", \"3/5\", \"They are equal\", \"Cannot tell\"]', '2/3', 'Convert to same denominator: 2/3 = 10/15, 3/5 = 9/15. 10/15 > 9/15.', 2);

        -- Mathematics: Linear Equations (JSS2)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q1', 'maths-jss2-t4', 'Solve for x: 2x + 5 = 15', 'mcq', '[\"x = 3\", \"x = 5\", \"x = 7\", \"x = 10\"]', 'x = 5', 'Subtract 5 from both sides: 2x = 10. Divide by 2: x = 5.', 2),
            ('q2', 'maths-jss2-t4', 'Solve for x: 3x - 7 = 14', 'mcq', '[\"x = 7\", \"x = 3\", \"x = 21\", \"x = 5\"]', 'x = 7', 'Add 7 to both sides: 3x = 21. Divide by 3: x = 7.', 2),
            ('q3', 'maths-jss2-t4', 'Solve for y: 5y + 3 = 28', 'mcq', '[\"y = 4\", \"y = 5\", \"y = 6\", \"y = 7\"]', 'y = 5', 'Subtract 3: 5y = 25. Divide by 5: y = 5.', 2),
            ('q4', 'maths-jss2-t4', 'What is the value of x if 4x = 36?', 'mcq', '[\"x = 6\", \"x = 8\", \"x = 9\", \"x = 12\"]', 'x = 9', 'Divide both sides by 4: x = 36/4 = 9.', 1),
            ('q5', 'maths-jss2-t4', 'Solve: x/3 + 4 = 10', 'mcq', '[\"x = 18\", \"x = 2\", \"x = 6\", \"x = 12\"]', 'x = 18', 'Subtract 4: x/3 = 6. Multiply by 3: x = 18.', 3);

        -- English: Parts of Speech (JSS1)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q6', 'eng-jss1-t1', 'Which word is a noun in this sentence: \"The boy runs fast\"?', 'mcq', '[\"The\", \"boy\", \"runs\", \"fast\"]', 'boy', 'A noun is a word that names a person, place, or thing. \"Boy\" names a person.', 1),
            ('q7', 'eng-jss1-t1', 'What part of speech is the word \"beautiful\" in \"She is beautiful\"?', 'mcq', '[\"Noun\", \"Verb\", \"Adjective\", \"Adverb\"]', 'Adjective', 'An adjective describes a noun or pronoun. \"Beautiful\" describes \"she\".', 1),
            ('q8', 'eng-jss1-t1', 'Identify the verb: \"The students studied hard for the exam.\"', 'mcq', '[\"students\", \"studied\", \"hard\", \"exam\"]', 'studied', 'A verb shows action or state of being. \"Studied\" shows the action performed.', 1),
            ('q9', 'eng-jss1-t1', 'Which is an adverb in: \"She sings beautifully\"?', 'mcq', '[\"She\", \"sings\", \"beautifully\", \"None\"]', 'beautifully', 'An adverb modifies a verb. \"Beautifully\" tells us how she sings.', 2),
            ('q10', 'eng-jss1-t1', 'What is the pronoun in: \"He gave it to them\"?', 'mcq', '[\"He, it, them\", \"gave, to\", \"He only\", \"it only\"]', 'He, it, them', 'Pronouns replace nouns. He, it, and them are all pronouns in this sentence.', 2);

        -- Basic Science: Photosynthesis (JSS2)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q-sci-1', 'sci-jss2-t1', 'What gas do plants absorb during photosynthesis?', 'mcq', '[\"Oxygen\", \"Carbon dioxide\", \"Nitrogen\", \"Hydrogen\"]', 'Carbon dioxide', 'Plants absorb carbon dioxide (CO2) from the air and use it with water and sunlight to make glucose.', 1),
            ('q-sci-2', 'sci-jss2-t1', 'Where does photosynthesis mainly take place in a plant?', 'mcq', '[\"Roots\", \"Stem\", \"Leaves\", \"Flowers\"]', 'Leaves', 'Photosynthesis mainly occurs in the leaves because they contain chlorophyll in chloroplasts.', 1),
            ('q-sci-3', 'sci-jss2-t1', 'What is the green pigment in plants called?', 'mcq', '[\"Melanin\", \"Chlorophyll\", \"Carotene\", \"Haemoglobin\"]', 'Chlorophyll', 'Chlorophyll is the green pigment that traps sunlight energy for photosynthesis.', 1),
            ('q-sci-4', 'sci-jss2-t1', 'What are the products of photosynthesis?', 'mcq', '[\"Carbon dioxide and water\", \"Glucose and oxygen\", \"Nitrogen and glucose\", \"Water and oxygen\"]', 'Glucose and oxygen', 'The equation: CO2 + H2O + Light → Glucose + O2. Products are glucose and oxygen.', 2),
            ('q-sci-5', 'sci-jss2-t1', 'Which of these is NOT needed for photosynthesis?', 'mcq', '[\"Sunlight\", \"Water\", \"Carbon dioxide\", \"Soil\"]', 'Soil', 'Photosynthesis needs sunlight, water, and CO2. Soil provides minerals but is not directly used in photosynthesis.', 2);

        -- Economics: Basic Concepts (SS1)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q-econ-1', 'econ-ss1-t1', 'What is scarcity in economics?', 'mcq', '[\"Having too much of everything\", \"Limited resources to satisfy unlimited wants\", \"When goods are expensive\", \"When there is no money\"]', 'Limited resources to satisfy unlimited wants', 'Scarcity means resources are limited while human wants are unlimited. This is the basic economic problem.', 1),
            ('q-econ-2', 'econ-ss1-t1', 'What is opportunity cost?', 'mcq', '[\"The price of goods\", \"The next best alternative forgone\", \"The total cost of production\", \"Money spent on wants\"]', 'The next best alternative forgone', 'Opportunity cost is the value of the next best alternative that is given up when a choice is made.', 2),
            ('q-econ-3', 'econ-ss1-t1', 'What is a scale of preference?', 'mcq', '[\"A weighing scale\", \"A list of wants arranged in order of priority\", \"The price list of goods\", \"A measurement of income\"]', 'A list of wants arranged in order of priority', 'A scale of preference is a list of wants arranged in order of their importance to the individual.', 1),
            ('q-econ-4', 'econ-ss1-t1', 'Choice in economics arises because of:', 'mcq', '[\"Abundance of resources\", \"Scarcity of resources\", \"Government policies\", \"High prices\"]', 'Scarcity of resources', 'Because resources are scarce, individuals and societies must make choices about how to use them.', 1),
            ('q-econ-5', 'econ-ss1-t1', 'If you choose to buy a textbook instead of a shirt, the opportunity cost is:', 'mcq', '[\"The textbook\", \"The shirt\", \"Both items\", \"Neither item\"]', 'The shirt', 'The opportunity cost is the shirt — it is the next best alternative you gave up when you chose the textbook.', 2);

        -- Biology: Cell Structure (SS1)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q-bio-1', 'bio-ss1-t1', 'Which organelle is known as the powerhouse of the cell?', 'mcq', '[\"Nucleus\", \"Ribosome\", \"Mitochondria\", \"Golgi body\"]', 'Mitochondria', 'Mitochondria produce ATP through cellular respiration, providing energy for the cell.', 1),
            ('q-bio-2', 'bio-ss1-t1', 'Which structure is found in plant cells but NOT in animal cells?', 'mcq', '[\"Nucleus\", \"Cell wall\", \"Mitochondria\", \"Ribosome\"]', 'Cell wall', 'Plant cells have a rigid cell wall made of cellulose outside the cell membrane. Animal cells lack this.', 1),
            ('q-bio-3', 'bio-ss1-t1', 'What is the function of the nucleus?', 'mcq', '[\"Energy production\", \"Protein synthesis\", \"Controls cell activities and contains DNA\", \"Digests waste\"]', 'Controls cell activities and contains DNA', 'The nucleus contains the cell''s genetic material (DNA) and controls all cell activities.', 1),
            ('q-bio-4', 'bio-ss1-t1', 'The cell membrane is described as:', 'mcq', '[\"Fully permeable\", \"Semi-permeable\", \"Impermeable\", \"Rigid\"]', 'Semi-permeable', 'The cell membrane is semi-permeable (selectively permeable) — it allows some substances to pass through but not others.', 2),
            ('q-bio-5', 'bio-ss1-t1', 'Which organelle is responsible for photosynthesis?', 'mcq', '[\"Mitochondria\", \"Chloroplast\", \"Nucleus\", \"Vacuole\"]', 'Chloroplast', 'Chloroplasts contain chlorophyll and are the site of photosynthesis in plant cells.', 1);

        -- Physics: Motion (SS1)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q-phy-1', 'phy-ss1-t3', 'What is the SI unit of velocity?', 'mcq', '[\"m/s\", \"km/h\", \"m/s²\", \"N\"]', 'm/s', 'Velocity is measured in metres per second (m/s) in SI units.', 1),
            ('q-phy-2', 'phy-ss1-t3', 'A car travels 100m in 10 seconds. What is its speed?', 'mcq', '[\"5 m/s\", \"10 m/s\", \"15 m/s\", \"1000 m/s\"]', '10 m/s', 'Speed = Distance / Time = 100m / 10s = 10 m/s.', 1),
            ('q-phy-3', 'phy-ss1-t3', 'What is the difference between speed and velocity?', 'mcq', '[\"No difference\", \"Velocity has direction\", \"Speed has direction\", \"Velocity is always faster\"]', 'Velocity has direction', 'Speed is a scalar (magnitude only), while velocity is a vector (has both magnitude and direction).', 2),
            ('q-phy-4', 'phy-ss1-t3', 'Acceleration is defined as:', 'mcq', '[\"Distance over time\", \"Change in velocity over time\", \"Force times mass\", \"Speed times time\"]', 'Change in velocity over time', 'Acceleration = Change in velocity / Time taken. Its unit is m/s².', 2),
            ('q-phy-5', 'phy-ss1-t3', 'An object moving in a straight line at constant speed has:', 'mcq', '[\"Positive acceleration\", \"Negative acceleration\", \"Zero acceleration\", \"Variable acceleration\"]', 'Zero acceleration', 'If speed is constant, there is no change in velocity, so acceleration is zero.', 1);

        -- Chemistry: Atomic Structure (SS1)
        INSERT INTO questions (id, topic_id, question_text, question_type, options, correct_answer, explanation, difficulty) VALUES
            ('q-chem-1', 'chem-ss1-t2', 'Which subatomic particle has a positive charge?', 'mcq', '[\"Electron\", \"Neutron\", \"Proton\", \"Photon\"]', 'Proton', 'Protons have a positive charge, electrons have a negative charge, and neutrons have no charge.', 1),
            ('q-chem-2', 'chem-ss1-t2', 'Where are electrons found in an atom?', 'mcq', '[\"In the nucleus\", \"In electron shells/orbits\", \"Between atoms\", \"Inside protons\"]', 'In electron shells/orbits', 'Electrons orbit the nucleus in energy levels called electron shells.', 1),
            ('q-chem-3', 'chem-ss1-t2', 'The atomic number of an element is determined by:', 'mcq', '[\"Number of neutrons\", \"Number of protons\", \"Number of electrons\", \"Mass of the atom\"]', 'Number of protons', 'The atomic number equals the number of protons in the nucleus of an atom.', 1),
            ('q-chem-4', 'chem-ss1-t2', 'An atom with 11 protons and 12 neutrons has a mass number of:', 'mcq', '[\"11\", \"12\", \"23\", \"1\"]', '23', 'Mass number = protons + neutrons = 11 + 12 = 23.', 2),
            ('q-chem-5', 'chem-ss1-t2', 'Isotopes are atoms of the same element with different numbers of:', 'mcq', '[\"Protons\", \"Electrons\", \"Neutrons\", \"Photons\"]', 'Neutrons', 'Isotopes have the same number of protons but different numbers of neutrons, giving them different mass numbers.', 2);

        -- Default settings
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('school_name', 'SkoolBox Demo School'),
            ('tts_voice', 'Ezinne'),
            ('tts_speed', '1.0'),
            ('offline_mode', 'false'),
            ('azure_tts_region', 'westeurope');
        ",
    )
    .map_err(|e| format!("Failed to seed database: {}", e))?;

    Ok(())
}
