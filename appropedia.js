const Appropedia = {

	init() {
		Appropedia.fixFilters();
		Appropedia.bind();
		Appropedia.search();
	},

	/**
	 * Bind events
	 */
	bind() {
		// Update the search and the filter width when a filter changes
		const filters = document.getElementsByClassName( 'appropedia-filter' );
		for ( const filter of filters ) {
			filter.onchange = Appropedia.onFilterChange;
		}

		document.getElementById( 'add-project-button' ).onclick = Appropedia.openForm;
		document.getElementById( 'bookmarks-button' ).onclick = Appropedia.openBookmarks;

		// @todo Open the relevant publication when the hash changes
		//window.onhashchange = Appropedia.openDialog;

		// Close the dialog when clicking outside of it or on the close button
		document.getElementById( 'appropedia-dialog' ).onclick = Appropedia.closeDialog;
		document.getElementById( 'appropedia-dialog-content' ).onclick = event => event.stopPropagation();
		document.getElementById( 'appropedia-dialog-close-button' ).onclick = Appropedia.closeDialog;
	},

	async search() {

		const cards = document.getElementById( 'appropedia-cards' );
		cards.textContent = 'Searching...';

		// Set the query conditions
		const conditions = [
			'Category:Projects'
		];
		const params = new URLSearchParams( window.location.search );
		const type = params.get( 'type' );
		if ( type ) {
			conditions.push( 'Project type::' + type );
		}
		const status = params.get( 'status' );
		if ( status ) {
			conditions.push( 'Project status::' + status );
		}
		const environment = params.get( 'environment' );
		if ( environment ) {
			conditions.push( 'Project environment::' + environment );
		}
		const sdg = params.get( 'sdg' );
		if ( sdg ) {
			conditions.push( 'Page SDG::' + sdg );
		}
		const language = params.get( 'language' );
		if ( language ) {
			conditions.push( 'Page language::' + language );
		}
		const year = params.get( 'year' );
		if ( year ) {
			conditions.push( 'Project year::' + year );
		}

		const properties = [
			'Page language',
			'Project thumb',
			'Project description',
			'Project type',
			'Project status',
			'Project environment', // @todo
			'Project authors',
			'Project cost',
			'Project tools',
			'Project uses',
			'Project was made',
			'Project was replicated',
			'Project year',
		];
		const parameters = [
			'sort = Project year',
			'order = desc',
			'limit = 60'
		];
		const query = {
			origin: '*',
			format: 'json',
			action: 'askargs',
			conditions: conditions.join( '|' ),
			printouts: properties.join( '|' ),
			parameters: parameters.join( '|' ),
		};
		const response = await Appropedia.get( query );
		const results = Object.entries( response.query.results );

		// If no results are found, be done
		if ( !results.length ) {
			cards.textContent = 'No relevant projects found.';
			return;
		}

		cards.innerHTML = '';
		for ( const [ title, result ] of results ) {
			const project = {
				title: title,
				hash: title.replaceAll( ' ', '_' ),
				url: result.fullurl,
				thumb: result.printouts['Project thumb'][0],
				type: result.printouts['Project type'][0],
				status: result.printouts['Project status'][0],
				year: result.printouts['Project year'][0].raw.split( '/' ).pop(),
				language: result.printouts['Page language'][0],
				description: result.printouts['Project description'][0],
				authors: result.printouts['Project authors']
			};
			const card = Appropedia.makeCard( project );
			cards.append( card );
		}
	},

	makeCard( project ) {

		// Clone the template
		const template = document.getElementById( 'project-card-template' );
		const card = template.content.cloneNode( true ).children[0];

		// Set the thumbnail
		const thumb = card.querySelector( '.project-card-thumb' );
		if ( project.thumb ) {
			thumb.src = project.thumb;
		} else {
			thumb.remove();
		}

		// Set the title
		const title = card.querySelector( '.project-card-title' );
		title.textContent = project.title;

		// Bind events
		card.onclick = event => Appropedia.openProject( project, event );

		return card;
	},

	/**
	 * Filters are not selected by default, so we need to select them if the relevant query string is set
	 */
	fixFilters() {
		const params = new URLSearchParams( window.location.search );
		const filters = document.getElementsByClassName( 'appropedia-filter' );
		for ( const filter of filters ) {
			const name = filter.name;
			const value = params.get( name );
			if ( value ) {
				for ( const option of filter.options ) {
					if ( value === option.value ) {
						option.selected = 'selected';
						Appropedia.fixFilterWidth( filter );
					}
				}
			}
		}
	},

	/**
	 * Create a dummy filter to figure out the new optimal width
	 */
	fixFilterWidth( filter ) {
		const option = filter.options[ filter.selectedIndex ];
		const dummy = document.createElement( 'span' );
		dummy.textContent = option.text;
		dummy.className = 'appropedia-filter';
		dummy.style.position = 'absolute';
		dummy.style.visibility = 'hidden';
		document.body.append( dummy );
		filter.style.width = dummy.offsetWidth + 'px';
		dummy.remove();
	},

	onFilterChange( event ) {
		const filter = event.target;

		// Update the URL
		const url = new URL( window.location.href );
		const params = new URLSearchParams( url.search );
		if ( filter.value ) {
			params.set( filter.name, filter.value );
		} else {
			params.delete( filter.name );
		}
		url.search = params.toString();
		window.history.pushState( {}, '', url.toString() );

		// Update the width of the filter
		Appropedia.fixFilterWidth( filter );

		// Update the projects
		Appropedia.search();
	},

	async openProject( project, event ) {

		// Clone the template and add it to the dialog
		const template = document.getElementById( 'project-dialog-template' );
		Appropedia.openDialog( template.innerHTML );

		// Update the hash
		location.hash = project.hash;

		// Set the data
		const title = document.getElementById( 'project-dialog-title-link' );
		title.textContent = project.title;
		title.href = project.url;

		const thumb = document.getElementById( 'project-dialog-thumb' );
		if ( project.thumb ) {
			thumb.src = project.thumb;
		} else {
			thumb.remove();
		}

		if ( project.description ) {
			const description = document.getElementById( 'project-dialog-description' );
			description.textContent = project.description;
		}
		if ( project.type ) {
			const type = document.getElementById( 'project-dialog-type' );
			type.textContent = project.type.fulltext;
		}
		if ( project.status ) {
			const status = document.getElementById( 'project-dialog-status' );
			status.textContent = project.status;
		}
		if ( project.year ) {
			const year = document.getElementById( 'project-dialog-year' );
			year.textContent = project.year;
		}
		if ( project.language ) {
			const language = document.getElementById( 'project-dialog-language' );
			language.textContent = project.language;
		}
		if ( project.authors ) {
			const authors = document.getElementById( 'project-dialog-authors' );
			authors.innerHTML = project.authors.map( author => author.fulltext ).join( '<br>' );
		}

		// Get and display the table of contents
		const toc = document.getElementById( 'project-dialog-toc' );
		const query = {
			action: 'parse',
			page: project.title,
			prop: 'text'
		};
		const data = await Appropedia.get( query );
		const html = data.parse.text;
		const parser = new DOMParser();
		const doc = parser.parseFromString( html, 'text/html' );
		const list = doc.getElementById( 'toc' );
		if ( !list ) {
			toc.remove();
			return;
		}
		const links = list.getElementsByTagName( 'a' );
		for ( const link of links ) {
			link.target = '_blank';
			link.href = project.url + link.getAttribute( 'href' ); // Don't use link.href because it prepends the apps url
		}
		toc.textContent = '';
		toc.append( list );

		// Bind events
		const bookmarkButton = document.getElementById( 'project-dialog-bookmark-button' );
		if ( Appropedia.isBookmark( project ) ) {
			bookmarkButton.innerHTML = '&#9733;';
		}
		bookmarkButton.onclick = event => Appropedia.toggleBookmark( event, project );
	},

	getBookmarks() {
		const bookmarks = window.localStorage.getItem( 'bookmarks' );
		if ( bookmarks ) {
			return JSON.parse( bookmarks );
		}
		return [];
	},

	isBookmark( project ) {
		const bookmarks = Appropedia.getBookmarks();
		for ( const bookmark of bookmarks ) {
			if ( bookmark.title === project.title ) {
				return true;
			}
		}
		return false;
	},

	addBookmark( project ) {
		const bookmarks = Appropedia.getBookmarks();
		bookmarks.push( project );
		window.localStorage.setItem( 'bookmarks', JSON.stringify( bookmarks ) );
	},

	removeBookmark( project ) {
		const bookmarks = Appropedia.getBookmarks();
		for ( const index in bookmarks ) {
			const bookmark = bookmarks[ index ];
			if ( bookmark.title === project.title ) {
				bookmarks.splice( index, 1 );
				window.localStorage.setItem( 'bookmarks', JSON.stringify( bookmarks ) );
				return;
			}
		}
	},

	toggleBookmark( event, project ) {
		const button = event.target;
		if ( Appropedia.isBookmark( project ) ) {
			button.innerHTML = '&#9734;';
			Appropedia.removeBookmark( project );
		} else {
			button.innerHTML = '&#9733;';
			Appropedia.addBookmark( project );
		}
	},

	openBookmarks() {

		// Clone the template and add it to the dialog
		const template = document.getElementById( 'bookmarks-dialog-template' );
		Appropedia.openDialog( template.innerHTML );

		const cards = document.getElementById( 'bookmarks-dialog-cards' );
		const bookmarks = Appropedia.getBookmarks();
		if ( !bookmarks.length ) {
			cards.textContent = "You don't have any bookmarks yet.";
			return;
		}
		cards.textContent = '';
		for ( const bookmark of bookmarks ) {
			const card = Appropedia.makeCard( bookmark );
			cards.append( card );
		}

		// Bind events
		document.getElementById( 'bookmarks-dialog-pdf-button' ).onclick = Appropedia.downloadPDF;
	},

	async downloadPDF() {

		// Disable the button to prevent multiple clicks and hint the user that something is happening
		const button = this;
		const buttonText = button.textContent;
		button.textContent = 'Generating...';
		button.style.pointerEvents = 'none';

		// Get the titles of the bookmarks
		const bookmarks = Appropedia.getBookmarks();
		const titles = bookmarks.map( bookmark => bookmark.title );

		// Generate the PDF
		const url = 'https://www.appropedia.org/scripts/generatePDF.php?pages=' + titles.join( ',' );
		const result = await fetch( url );
		const bytes = await result.arrayBuffer();

		// Download the PDF
		const blob = new Blob( [ bytes ], { type: 'application/pdf' } );
		const href = URL.createObjectURL( blob );
		const a = document.createElement( 'a' );
		a.href = href;
		a.download = 'projects.pdf';
		document.body.appendChild( a );
		a.click();
		document.body.removeChild( a );
		URL.revokeObjectURL( href );

		// Re-enable the button
		button.textContent = buttonText;
		button.style.pointerEvents = '';
	},

	openForm( event ) {

		// Open the dialog with the form in it
		const template = document.getElementById( 'add-project-form-template' );
		Appropedia.openDialog( template.innerHTML );

		// Attach events
		const form = document.getElementById( 'add-project-form' );
		form.onsubmit = Appropedia.submitForm;
	},

	async submitForm( event ) {
		event.preventDefault();
		const form = this;

		const titleField = form.querySelector( 'input[name="title"]' );
		const title = titleField.value;
		if ( !title ) {
			titleField.focus();
			return;
		}

		const descriptionField = form.querySelector( 'textarea[name="description"]' );
		const description = descriptionField.value;
		if ( !description ) {
			descriptionField.focus();
			return;
		}

		// Disable the button to prevent multiple clicks and hint the user that something is happening
		const button = document.getElementById( 'add-project-form-button' );
		button.textContent = 'Publishing...';
		button.style.pointerEvents = 'none';

		// Build the wikitext
		let text = '{{Project data}}\n\n';
		text += description;

		const query = {
			action: 'edit',
			createonly: true,
			title: title,
			text: text,
			summary: 'Project created with the Appropedia projects app'
		};
		await Appropedia.post( query );

		const project = {
			title: title,
			hash: title.replaceAll( ' ', '_' ),
			url: 'https://www.appropedia.org/' + title.replaceAll( ' ', '_' ),
			description: description
		};
		Appropedia.openProject( project );
	},

	openDialog( html ) {
		Appropedia.closeDialog(); // Close any previous dialog
		document.getElementById( 'appropedia-dialog' ).showModal();
		document.getElementById( 'appropedia-dialog-content' ).innerHTML = html;
	},

	closeDialog() {
		document.getElementById( 'appropedia-dialog' ).close();
		document.getElementById( 'appropedia-dialog-content' ).innerHTML = '';

		// Empty the hash but preserve history
		window.history.pushState( null, null, ' ' );
	},

	/**
	 * Helper method to do GET requests to the Appropedia Action API
	 */
	async get( query ) {
		query.format = 'json';
		query.formatversion = 2;
		const queryString = new URLSearchParams( query ).toString();
		const response = await fetch( 'https://www.appropedia.org/w/api.php?' + queryString );
		if ( !response.ok ) {
			// @todo Error handling
		}
		const data = await response.json();
		return data;
	},

	/**
	 * Helper method to do POST requests to the Appropedia Action API
	 */
	async post( query ) {
		const data = await Appropedia.get( { action: 'query', meta: 'tokens' } );
		const token = data.query.tokens.csrftoken;
		query.token = token;
		query.format = 'json';
		query.formatversion = 2;
		const response = await fetch( 'https://www.appropedia.org/w/api.php', {
			method: 'POST',
			body: new URLSearchParams( query )
		} );
		if ( !response.ok ) {
			// @todo Error handling
		}
		const result = await response.json();
		return result;
	}
};

window.onload = Appropedia.init;